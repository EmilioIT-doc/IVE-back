import { pool, type DbClient } from "../../db.js";
import type { ProductInput, VariantInput } from "./admin.schemas.js";

type Db = DbClient | typeof pool;

export async function listProducts() {
  const { rows } = await pool.query<{
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    compareAtCents: number | null;
    viewCount: number;
    isActive: boolean;
    gender: string;
    categoryName: string;
    imageUrl: string | null;
    variantCount: number;
    totalStock: number;
    updatedAt: Date;
  }>(
    `SELECT p.id, p.slug, p.name, p.price_cents AS "priceCents", p.compare_at_cents AS "compareAtCents",
            p.view_count AS "viewCount", p.is_active AS "isActive",
            p.gender, c.name AS "categoryName",
            (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY position LIMIT 1) AS "imageUrl",
            COUNT(v.id) FILTER (WHERE v.is_active)::int AS "variantCount",
            COALESCE(SUM(v.stock) FILTER (WHERE v.is_active), 0)::int AS "totalStock",
            p.updated_at AS "updatedAt"
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_variants v ON v.product_id = p.id
     GROUP BY p.id, c.id
     ORDER BY p.created_at DESC, p.id DESC`
  );
  return rows;
}

export async function findProduct(db: Db, id: string) {
  const { rows } = await db.query<{
    id: string;
    categoryId: string;
    gender: string;
    name: string;
    slug: string;
    description: string | null;
    priceCents: number;
    compareAtCents: number | null;
    viewCount: number;
    isActive: boolean;
  }>(
    `SELECT id, category_id AS "categoryId", gender, name, slug, description,
            price_cents AS "priceCents", compare_at_cents AS "compareAtCents",
            view_count AS "viewCount", is_active AS "isActive"
     FROM products WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findVariants(db: Db, productId: string) {
  const { rows } = await db.query<{
    id: string;
    sku: string;
    size: string;
    color: string;
    stock: number;
    priceCents: number | null;
    isActive: boolean;
  }>(
    `SELECT id, sku, size, color, stock, price_cents AS "priceCents", is_active AS "isActive"
     FROM product_variants WHERE product_id = $1
     ORDER BY color, array_position(ARRAY['XS','S','M','L','XL','XXL'], size) NULLS LAST, size`,
    [productId]
  );
  return rows;
}

export async function findImages(db: Db, productId: string) {
  const { rows } = await db.query<{ id: string; url: string; altText: string | null; position: number }>(
    `SELECT id, url, alt_text AS "altText", position FROM product_images
     WHERE product_id = $1 ORDER BY position, id`,
    [productId]
  );
  return rows;
}

export async function slugExists(db: Db, slug: string, exceptId?: string) {
  const { rows } = await db.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM products WHERE slug = $1 AND id IS DISTINCT FROM $2::bigint) AS exists",
    [slug, exceptId ?? null]
  );
  return rows[0]!.exists;
}

export async function categoryExists(db: Db, id: string) {
  const { rows } = await db.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM categories WHERE id = $1) AS exists", [id]);
  return rows[0]!.exists;
}

export async function insertProduct(db: Db, p: Omit<ProductInput, "slug"> & { slug: string }) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO products (category_id, gender, name, slug, description, price_cents, compare_at_cents, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [p.categoryId, p.gender, p.name, p.slug, p.description ?? null, p.priceCents, p.compareAtCents ?? null, p.isActive]
  );
  return rows[0]!.id;
}

/** UPDATE dinámico: solo cambia las columnas que vienen (PATCH). */
export async function updateProduct(db: Db, id: string, p: Partial<ProductInput>) {
  const columns: Record<string, unknown> = {
    category_id: p.categoryId,
    gender: p.gender,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price_cents: p.priceCents,
    compare_at_cents: p.compareAtCents, // null = quitar la oferta (undefined = no tocar)
    is_active: p.isActive,
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`); // el nombre de columna sale de NUESTRO mapa, no del usuario
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.query(`UPDATE products SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
}

export async function insertVariant(db: Db, productId: string, sku: string, v: Omit<VariantInput, "id">) {
  await db.query(
    `INSERT INTO product_variants (product_id, sku, size, color, stock, price_cents, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, sku, v.size, v.color, v.stock, v.priceCents ?? null, v.isActive]
  );
}

export async function updateVariant(db: Db, productId: string, v: VariantInput & { id: string }) {
  await db.query(
    `UPDATE product_variants SET stock = $3, price_cents = $4, is_active = $5
     WHERE id = $1 AND product_id = $2`,
    [v.id, productId, v.stock, v.priceCents ?? null, v.isActive]
  );
}

/** Las variantes que ya no vienen se DESACTIVAN (no se borran: hay pedidos que las usan). */
export async function deactivateVariantsExcept(db: Db, productId: string, keepIds: string[]) {
  await db.query(
    `UPDATE product_variants SET is_active = FALSE
     WHERE product_id = $1 AND NOT (id = ANY($2::bigint[]))`,
    [productId, keepIds]
  );
}

export async function nextImagePosition(db: Db, productId: string) {
  const { rows } = await db.query<{ next: number }>(
    "SELECT COALESCE(MAX(position) + 1, 0)::int AS next FROM product_images WHERE product_id = $1",
    [productId]
  );
  return rows[0]!.next;
}

export async function insertImage(db: Db, productId: string, url: string, altText: string, position: number) {
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO product_images (product_id, url, alt_text, position) VALUES ($1, $2, $3, $4) RETURNING id",
    [productId, url, altText, position]
  );
  return rows[0]!.id;
}

export async function deleteImage(db: Db, productId: string, imageId: string) {
  const { rows } = await db.query<{ url: string }>(
    "DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING url",
    [imageId, productId]
  );
  return rows[0]?.url ?? null;
}

/**
 * Reordena con UNNEST: manda dos arreglos (ids y posiciones) y Postgres
 * los convierte en una tabla temporal para hacer un solo UPDATE.
 */
export async function reorderImages(db: Db, productId: string, ids: string[]) {
  const positions = ids.map((_, i) => i);
  await db.query(
    `UPDATE product_images AS i SET position = o.position
     FROM UNNEST($2::bigint[], $3::int[]) AS o(id, position)
     WHERE i.id = o.id AND i.product_id = $1`,
    [productId, ids, positions]
  );
}
