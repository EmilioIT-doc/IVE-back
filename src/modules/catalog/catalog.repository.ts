import { pool } from "../../db.js";
import { framingSql, type Framing } from "../../lib/framing.js";
import type { ListProductsFilters } from "./catalog.schemas.js";

export type Gender = "unisex" | "hombre" | "mujer";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
  coverFraming: Framing;
  productCount: number;
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  compareAtCents: number | null; // precio "antes" (oferta)
  gender: Gender;
  category: { slug: string; name: string };
  colors: string[];
  ratingAverage: number | null;
  reviewCount: number;
  imageUrl: string | null;
  hoverImageUrl: string | null; // segunda foto (ej. la espalda) para el efecto hover
  isNew: boolean;
};

// Columnas que comparten el listado y los relacionados.
const LIST_COLUMNS = `
  p.id, p.slug, p.name, p.price_cents AS "priceCents", p.compare_at_cents AS "compareAtCents", p.gender,
  (SELECT ROUND(AVG(r.rating), 1)::float8 FROM reviews r WHERE r.product_id = p.id AND NOT r.is_hidden) AS "ratingAverage",
  (SELECT COUNT(*)::int FROM reviews r WHERE r.product_id = p.id AND NOT r.is_hidden) AS "reviewCount",
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
  (SELECT i.url FROM product_images i
   WHERE i.product_id = p.id
   ORDER BY i.position OFFSET 1 LIMIT 1) AS "hoverImageUrl",
  (p.created_at > NOW() - INTERVAL '30 days') AS "isNew"
`;

type ListRow = Omit<ProductListItem, "category"> & { categorySlug: string; categoryName: string };

function toListItem(r: ListRow): ProductListItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    priceCents: r.priceCents,
    compareAtCents: r.compareAtCents,
    gender: r.gender,
    category: { slug: r.categorySlug, name: r.categoryName },
    colors: r.colors,
    imageUrl: r.imageUrl,
    hoverImageUrl: r.hoverImageUrl,
    ratingAverage: r.ratingAverage,
    reviewCount: r.reviewCount,
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
  // Solo productos visibles de categorías visibles
  const where: string[] = ["p.is_active", "c.is_active"];
  const params: unknown[] = [];
  // Agrega un valor a params y regresa su placeholder ($1, $2, ...)
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (f.category) where.push(`c.slug = ${add(f.category)}`);

  // "Mujer" = lo de mujer + lo unisex (igual "Hombre"); "Unisex" = solo unisex
  if (f.gender === "unisex") where.push("p.gender = 'unisex'");
  else if (f.gender) where.push(`p.gender IN (${add(f.gender)}, 'unisex')`);

  if (f.size.length > 0 || f.color.length > 0) {
    // Solo productos que tengan una variante disponible con esa talla/color
    const cond = ["v.product_id = p.id", "v.is_active", "v.stock > 0"];
    if (f.size.length > 0) cond.push(`v.size = ANY(${add(f.size)}::text[])`);
    if (f.color.length > 0) cond.push(`v.color = ANY(${add(f.color)}::text[])`);
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE ${cond.join(" AND ")})`);
  }

  if (f.sale) where.push("p.compare_at_cents IS NOT NULL"); // solo lo que está en oferta

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
      `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`,
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
    compareAtCents: number | null;
    viewCount: number;
    gender: Gender;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
  }>(
    `SELECT p.id, p.slug, p.name, p.description, p.price_cents AS "priceCents",
            p.compare_at_cents AS "compareAtCents", p.view_count AS "viewCount", p.gender,
            c.id AS "categoryId", c.name AS "categoryName", c.slug AS "categorySlug"
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.is_active AND c.is_active`,
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

export async function findRelated(productId: string, categoryId: string, gender: Gender, limit: number) {
  // Primero los de la misma categoría, luego los del mismo público, luego el resto
  const { rows } = await pool.query<ListRow>(
    `SELECT ${LIST_COLUMNS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_active AND c.is_active AND p.id <> $1
     ORDER BY (p.category_id = $2) DESC,
              (p.gender = $3 OR p.gender = 'unisex') DESC,
              p.created_at DESC, p.id DESC
     LIMIT $4`,
    [productId, categoryId, gender, limit]
  );
  return rows.map(toListItem);
}

export async function findAllCategories() {
  // Solo las visibles, en el orden que eligió el admin, con cuántos productos tienen
  const { rows } = await pool.query<CategoryRow>(
    `SELECT c.id, c.name, c.slug, c.cover_url AS "coverUrl",
            ${framingSql("c.cover_zoom", "c.cover_focus_x", "c.cover_focus_y")} AS "coverFraming",
            COUNT(p.id) FILTER (WHERE p.is_active)::int AS "productCount"
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     WHERE c.is_active
     GROUP BY c.id
     ORDER BY c.position, c.id`
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

/** Favoritos de un usuario, con las mismas columnas que el catálogo (para reusar la tarjeta). */
export async function findFavorites(userId: string) {
  const { rows } = await pool.query<ListRow>(
    `SELECT ${LIST_COLUMNS}
     FROM favorites f
     JOIN products p ON p.id = f.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE f.user_id = $1 AND p.is_active AND c.is_active
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return rows.map(toListItem);
}

/** +1 vista, de forma atómica (dos visitas al mismo tiempo no se pisan). */
export async function incrementViews(slug: string) {
  const { rows } = await pool.query<{ viewCount: number }>(
    `UPDATE products SET view_count = view_count + 1
     WHERE slug = $1 AND is_active
     RETURNING view_count AS "viewCount"`,
    [slug]
  );
  return rows[0]?.viewCount ?? null;
}

export async function findViewCount(slug: string) {
  const { rows } = await pool.query<{ viewCount: number }>(
    `SELECT view_count AS "viewCount" FROM products WHERE slug = $1 AND is_active`,
    [slug]
  );
  return rows[0]?.viewCount ?? null;
}
