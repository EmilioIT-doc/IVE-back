import { pool } from "../../db.js";
import type { ListProductsFilters } from "./catalog.schemas.js";

export type CategoryRow = { id: string; name: string; slug: string; parentId: string | null };

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  category: { slug: string; name: string };
  colors: string[];
  imageUrl: string | null;
  isNew: boolean;
};

// Columnas que comparten el listado y los relacionados.
const LIST_COLUMNS = `
  p.id, p.slug, p.name, p.price_cents AS "priceCents",
  c.slug AS "categorySlug", c.name AS "categoryName",
  COALESCE(
    (SELECT array_agg(DISTINCT v.color ORDER BY v.color)
     FROM product_variants v
     WHERE v.product_id = p.id AND v.is_active),
    '{}'
  ) AS colors,
  (SELECT i.url FROM product_images i
   WHERE i.product_id = p.id
   ORDER BY i.position LIMIT 1) AS "imageUrl",
  (p.created_at > NOW() - INTERVAL '30 days') AS "isNew"
`;

type ListRow = Omit<ProductListItem, "category"> & { categorySlug: string; categoryName: string };

function toListItem(r: ListRow): ProductListItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    priceCents: r.priceCents,
    category: { slug: r.categorySlug, name: r.categoryName },
    colors: r.colors,
    imageUrl: r.imageUrl,
    isNew: r.isNew,
  };
}

// El ORDER BY NUNCA se arma con texto del usuario: se elige de este mapa.
const ORDER_BY: Record<ListProductsFilters["sort"], string> = {
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "p.price_cents ASC, p.id ASC",
  price_desc: "p.price_cents DESC, p.id DESC",
};

export async function listProducts(f: ListProductsFilters) {
  const where: string[] = ["p.is_active"];
  const params: unknown[] = [];
  // Agrega un valor a params y regresa su placeholder ($1, $2, ...)
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (f.category) {
    // La categoría pedida o cualquiera de sus hijas (Hombre → Playeras, Sudaderas…)
    const ph = add(f.category);
    where.push(`p.category_id IN (
      SELECT id FROM categories
      WHERE slug = ${ph} OR parent_id = (SELECT id FROM categories WHERE slug = ${ph})
    )`);
  }

  if (f.size.length > 0 || f.color.length > 0) {
    // Solo productos que tengan una variante disponible con esa talla/color
    const cond = ["v.product_id = p.id", "v.is_active", "v.stock > 0"];
    if (f.size.length > 0) cond.push(`v.size = ANY(${add(f.size)}::text[])`);
    if (f.color.length > 0) cond.push(`v.color = ANY(${add(f.color)}::text[])`);
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE ${cond.join(" AND ")})`);
  }

  if (f.minPriceCents !== undefined) where.push(`p.price_cents >= ${add(f.minPriceCents)}`);
  if (f.maxPriceCents !== undefined) where.push(`p.price_cents <= ${add(f.maxPriceCents)}`);

  if (f.q) {
    // Escapamos % y _ para que se busquen literalmente
    const escaped = f.q.replace(/[\\%_]/g, "\\$&");
    where.push(`p.name ILIKE ${add(`%${escaped}%`)}`);
  }

  const whereSql = where.join(" AND ");
  const limitPh = add(f.limit);
  const offsetPh = add((f.page - 1) * f.limit);

  // COUNT(*) OVER() es una "función de ventana": cuenta el total de filas
  // que cumplen el WHERE, aunque solo devolvamos una página.
  const { rows } = await pool.query<ListRow & { totalCount: string }>(
    `SELECT ${LIST_COLUMNS}, COUNT(*) OVER() AS "totalCount"
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE ${whereSql}
     ORDER BY ${ORDER_BY[f.sort]}
     LIMIT ${limitPh} OFFSET ${offsetPh}`,
    params
  );

  let total = rows.length > 0 ? Number(rows[0]!.totalCount) : 0;
  if (rows.length === 0 && f.page > 1) {
    // Página fuera de rango: igual informamos el total real
    const countParams = params.slice(0, params.length - 2);
    const { rows: c } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`,
      countParams
    );
    total = Number(c[0]?.total ?? 0);
  }

  return { items: rows.map(toListItem), total };
}

export async function findProductBySlug(slug: string) {
  const { rows } = await pool.query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    priceCents: number;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    parentId: string | null;
    parentName: string | null;
    parentSlug: string | null;
  }>(
    `SELECT p.id, p.slug, p.name, p.description, p.price_cents AS "priceCents",
            c.id AS "categoryId", c.name AS "categoryName", c.slug AS "categorySlug",
            parent.id AS "parentId", parent.name AS "parentName", parent.slug AS "parentSlug"
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories parent ON parent.id = c.parent_id
     WHERE p.slug = $1 AND p.is_active`,
    [slug]
  );
  return rows[0] ?? null;
}

export async function findVariantsByProductId(productId: string) {
  const { rows } = await pool.query<{
    id: string;
    sku: string;
    size: string;
    color: string;
    priceCents: number;
    stock: number;
  }>(
    `SELECT v.id, v.sku, v.size, v.color,
            COALESCE(v.price_cents, p.price_cents) AS "priceCents",
            v.stock
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.product_id = $1 AND v.is_active
     ORDER BY v.color,
              array_position(ARRAY['XS','S','M','L','XL','XXL'], v.size) NULLS LAST,
              v.size`,
    [productId]
  );
  return rows;
}

export async function findImagesByProductId(productId: string) {
  const { rows } = await pool.query<{ url: string; altText: string | null }>(
    `SELECT url, alt_text AS "altText" FROM product_images
     WHERE product_id = $1 ORDER BY position`,
    [productId]
  );
  return rows;
}

export async function findRelated(productId: string, categoryId: string, parentId: string | null, limit: number) {
  // Primero los de la misma categoría, luego los de la misma categoría padre, luego el resto
  const { rows } = await pool.query<ListRow>(
    `SELECT ${LIST_COLUMNS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_active AND p.id <> $1
     ORDER BY (p.category_id = $2) DESC,
              (c.parent_id IS NOT DISTINCT FROM $3::bigint) DESC,
              p.created_at DESC, p.id DESC
     LIMIT $4`,
    [productId, categoryId, parentId, limit]
  );
  return rows.map(toListItem);
}

export async function findAllCategories() {
  const { rows } = await pool.query<CategoryRow>(
    `SELECT id, name, slug, parent_id AS "parentId"
     FROM categories
     ORDER BY parent_id NULLS FIRST, id`
  );
  return rows;
}

export async function findFilterOptions() {
  const [sizes, colors, price] = await Promise.all([
    pool.query<{ size: string }>(
      `SELECT DISTINCT v.size FROM product_variants v
       JOIN products p ON p.id = v.product_id
       WHERE p.is_active AND v.is_active`
    ),
    pool.query<{ color: string }>(
      `SELECT DISTINCT v.color FROM product_variants v
       JOIN products p ON p.id = v.product_id
       WHERE p.is_active AND v.is_active
       ORDER BY v.color`
    ),
    pool.query<{ min: number | null; max: number | null }>(
      `SELECT MIN(price_cents) AS min, MAX(price_cents) AS max FROM products WHERE is_active`
    ),
  ]);
  return {
    sizes: sizes.rows.map((r) => r.size),
    colors: colors.rows.map((r) => r.color),
    minPriceCents: price.rows[0]?.min ?? 0,
    maxPriceCents: price.rows[0]?.max ?? 0,
  };
}
