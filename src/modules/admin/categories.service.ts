import { isUniqueViolation, pool, withTransaction, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import { slugify } from "../../lib/slug.js";
import type { Framing } from "../../lib/framing.js";
import { deleteUploadedFile } from "../../lib/uploads.js";
import * as repo from "./categories.repository.js";
import { RESERVED_SLUGS, type CategoryInput } from "./categories.schemas.js";

const notFound = () => new AppError(404, "CATEGORY_NOT_FOUND", "Categoría no encontrada");

async function getOrThrow(db: DbClient | typeof pool, id: string) {
  const category = await repo.find(db, id);
  if (!category) throw notFound();
  return category;
}

/** Slug a partir del nombre ("Crop tops" → "crop-tops"); si ya existe, agrega -2, -3… */
async function uniqueSlug(db: DbClient, name: string, exceptId?: string) {
  let root = slugify(name) || "categoria";
  if (RESERVED_SLUGS.includes(root)) root = `${root}-ropa`; // "Mujer" → "mujer-ropa"
  let slug = root;
  for (let n = 2; await repo.slugExists(db, slug, exceptId); n++) slug = `${root}-${n}`;
  return slug;
}

function slugTaken(err: unknown): never {
  if (isUniqueViolation(err)) throw new AppError(409, "SLUG_TAKEN", "Ya existe una categoría con ese slug");
  throw err;
}

export const list = () => repo.list();
export const get = (id: string) => getOrThrow(pool, id);

export async function create(input: CategoryInput) {
  try {
    return await withTransaction(async (db) => {
      const slug = input.slug ?? (await uniqueSlug(db, input.name));
      const id = await repo.insert(db, { ...input, slug });
      return getOrThrow(db, id);
    });
  } catch (err) {
    slugTaken(err);
  }
}

export async function update(id: string, input: Partial<CategoryInput>) {
  try {
    return await withTransaction(async (db) => {
      await getOrThrow(db, id);
      await repo.update(db, id, input);
      return getOrThrow(db, id);
    });
  } catch (err) {
    slugTaken(err);
  }
}

/** Reordena (el orden es el del home y del menú). Debe venir la lista completa. */
export async function reorder(ids: string[]) {
  return withTransaction(async (db) => {
    const current = await repo.list(db);
    const same = current.length === ids.length && current.every((c) => ids.includes(c.id));
    if (!same) throw new AppError(400, "INVALID_ORDER", "La lista debe incluir todas las categorías");
    await repo.reorder(db, ids);
    return repo.list(db);
  });
}

/**
 * Solo se borra una categoría vacía. Si tiene productos (aunque estén ocultos),
 * primero hay que moverlos: la base lo impide de todos modos (ON DELETE RESTRICT).
 */
export async function remove(id: string) {
  const removed = await withTransaction(async (db) => {
    const category = await getOrThrow(db, id);
    if (category.productCount > 0) {
      throw new AppError(409, "CATEGORY_NOT_EMPTY", `Tiene ${category.productCount} producto(s): muévelos a otra categoría u oculta la categoría`, {
        productCount: category.productCount,
      });
    }
    return repo.remove(db, id);
  }).catch((err: { code?: string }) => {
    // 23503 = violación de llave foránea: alguien le agregó un producto justo ahora
    if (err.code === "23503") throw new AppError(409, "CATEGORY_NOT_EMPTY", "La categoría tiene productos");
    throw err;
  });
  if (removed?.coverUrl) await deleteUploadedFile(removed.coverUrl); // después del COMMIT
}

/** Guarda zoom y posición de la portada (la foto no se toca). */
export async function updateCoverFraming(id: string, framing: Framing) {
  const category = await getOrThrow(pool, id);
  if (!category.coverUrl) throw new AppError(409, "NO_COVER", "Primero sube una portada");
  await repo.setCoverFraming(pool, id, framing);
  return getOrThrow(pool, id);
}

export async function removeCover(id: string) {
  const old = await withTransaction(async (db) => {
    const cover = await repo.lockCover(db, id);
    if (!cover) throw notFound();
    await repo.setCover(db, id, null);
    return cover.coverUrl;
  });
  if (old) await deleteUploadedFile(old);
  return get(id);
}
