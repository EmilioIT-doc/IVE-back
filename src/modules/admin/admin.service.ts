import { isUniqueViolation, pool, withTransaction, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import { skuPart, slugify } from "../../lib/slug.js";
import { deleteUploadedFile } from "../../lib/uploads.js";
import * as repo from "./admin.repository.js";
import type { ProductInput, VariantInput } from "./admin.schemas.js";

/** SKU automático: P<id>-<COLOR>-<TALLA> → "P9-AZUL-MARINO-M" */
const skuFor = (productId: string, color: string, size: string) => `P${productId}-${skuPart(color)}-${skuPart(size)}`;

/** Slug a partir del nombre; si ya existe, agrega -2, -3… */
async function uniqueSlug(db: DbClient, base: string, exceptId?: string) {
  const root = slugify(base) || "producto";
  let slug = root;
  for (let n = 2; await repo.slugExists(db, slug, exceptId); n++) slug = `${root}-${n}`;
  return slug;
}

async function assertCategory(db: DbClient, categoryId: string | undefined) {
  if (categoryId && !(await repo.categoryExists(db, categoryId))) {
    throw new AppError(400, "CATEGORY_NOT_FOUND", "La categoría no existe");
  }
}

export const listProducts = repo.listProducts;

export async function getProduct(id: string, db: DbClient | typeof pool = pool) {
  const product = await repo.findProduct(db, id);
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
  const [variants, images] = await Promise.all([repo.findVariants(db, id), repo.findImages(db, id)]);
  return { ...product, variants, images };
}

/** El precio "antes" solo tiene sentido si es mayor que el actual. */
function assertCompareAt(priceCents: number, compareAtCents: number | null | undefined) {
  if (compareAtCents != null && compareAtCents <= priceCents) {
    throw new AppError(400, "INVALID_COMPARE_AT", "El precio \"antes\" debe ser mayor que el precio actual");
  }
}

export async function createProduct(input: ProductInput & { variants: Omit<VariantInput, "id">[] }) {
  assertCompareAt(input.priceCents, input.compareAtCents);
  try {
    return await withTransaction(async (db) => {
      await assertCategory(db, input.categoryId);
      const slug = input.slug ?? (await uniqueSlug(db, input.name));
      const id = await repo.insertProduct(db, { ...input, slug });
      for (const v of input.variants) await repo.insertVariant(db, id, skuFor(id, v.color, v.size), v);
      return getProduct(id, db);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "SLUG_TAKEN", "Ya existe un producto con ese slug");
    throw err;
  }
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  try {
    return await withTransaction(async (db) => {
      const current = await repo.findProduct(db, id);
      if (!current) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
      await assertCategory(db, input.categoryId);
      // Si solo cambia uno de los dos precios, se compara contra el otro que ya estaba guardado
      assertCompareAt(input.priceCents ?? current.priceCents, input.compareAtCents === undefined ? current.compareAtCents : input.compareAtCents);
      await repo.updateProduct(db, id, input);
      return getProduct(id, db);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "SLUG_TAKEN", "Ya existe un producto con ese slug");
    throw err;
  }
}

/**
 * Sincroniza la lista completa de variantes:
 * - con id → se actualiza (stock, precio, activa)
 * - sin id → se crea (o se reactiva si esa talla/color ya existía)
 * - las que no vienen → se desactivan
 */
export async function syncVariants(id: string, variants: VariantInput[]) {
  return withTransaction(async (db) => {
    if (!(await repo.findProduct(db, id))) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
    const existing = await repo.findVariants(db, id);
    const keep: string[] = [];

    for (const v of variants) {
      const match = v.id
        ? existing.find((e) => e.id === v.id)
        : existing.find((e) => e.size === v.size && e.color === v.color);
      if (v.id && !match) throw new AppError(400, "VARIANT_NOT_FOUND", `La variante ${v.id} no es de este producto`);

      if (match) {
        await repo.updateVariant(db, id, { ...v, id: match.id });
        keep.push(match.id);
      } else {
        await repo.insertVariant(db, id, skuFor(id, v.color, v.size), v);
      }
    }
    // Los ids recién creados no están en `keep`: los volvemos a leer para no desactivarlos
    const fresh = await repo.findVariants(db, id);
    const newIds = fresh.filter((f) => !existing.some((e) => e.id === f.id)).map((f) => f.id);
    await repo.deactivateVariantsExcept(db, id, [...keep, ...newIds]);
    return getProduct(id, db);
  });
}

export async function removeImage(id: string, imageId: string) {
  const result = await withTransaction(async (db) => {
    const url = await repo.deleteImage(db, id, imageId);
    if (!url) throw new AppError(404, "IMAGE_NOT_FOUND", "Imagen no encontrada");
    // Recompactamos las posiciones (0, 1, 2…) para que la portada siga siendo la 0
    const images = await repo.findImages(db, id);
    await repo.reorderImages(db, id, images.map((i) => i.id));
    return { url, product: await getProduct(id, db) };
  });
  await deleteUploadedFile(result.url); // el archivo se borra solo si la transacción salió bien
  return result.product;
}

export async function reorderImages(id: string, ids: string[]) {
  return withTransaction(async (db) => {
    const images = await repo.findImages(db, id);
    const same = images.length === ids.length && images.every((i) => ids.includes(i.id));
    if (!same) throw new AppError(400, "INVALID_ORDER", "La lista debe incluir todas las fotos del producto");
    await repo.reorderImages(db, id, ids);
    return getProduct(id, db);
  });
}
