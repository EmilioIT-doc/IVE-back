import { pool } from "../../db.js";
import type { ReviewInput } from "./reviews.schemas.js";

export type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  authorName: string;
  verifiedPurchase: boolean;
  isHidden: boolean;
  isMine: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * "Compra verificada": la persona tiene un pedido pagado (o enviado/entregado)
 * con alguna variante de este producto.
 */
const VERIFIED_PURCHASE = `EXISTS (
  SELECT 1 FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN product_variants v ON v.id = oi.variant_id
  WHERE o.user_id = r.user_id AND v.product_id = r.product_id
    AND o.status IN ('paid', 'shipped', 'delivered')
)`;

// "Emilio S." — nombre y la inicial del apellido (no exponemos el apellido completo)
const COLUMNS = (userParam: string) => `
  r.id, r.rating, r.title, r.comment,
  u.first_name || ' ' || left(u.last_name, 1) || '.' AS "authorName",
  ${VERIFIED_PURCHASE} AS "verifiedPurchase",
  r.is_hidden AS "isHidden",
  (r.user_id = ${userParam}::bigint) AS "isMine",
  r.created_at AS "createdAt", r.updated_at AS "updatedAt"`;

const ORDER = {
  recent: "r.created_at DESC, r.id DESC",
  best: "r.rating DESC, r.created_at DESC",
  worst: "r.rating ASC, r.created_at DESC",
} as const;

export async function findProductId(slug: string) {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM products WHERE slug = $1 AND is_active", [slug]);
  return rows[0]?.id ?? null;
}

/** Resumen: promedio, total y cuántas hay de cada estrella (solo visibles). */
export async function summary(productId: string) {
  const { rows } = await pool.query<{ rating: number; n: number }>(
    `SELECT rating, COUNT(*)::int AS n FROM reviews WHERE product_id = $1 AND NOT is_hidden GROUP BY rating`,
    [productId]
  );
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    distribution[r.rating as 1] = r.n;
    count += r.n;
    sum += r.rating * r.n;
  }
  return { count, average: count ? Math.round((sum / count) * 10) / 10 : null, distribution };
}

export async function list(productId: string, userId: string | null, sort: keyof typeof ORDER, limit: number, offset: number) {
  const { rows } = await pool.query<ReviewRow>(
    `SELECT ${COLUMNS("$2")}
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND NOT r.is_hidden
     ORDER BY ${ORDER[sort]}
     LIMIT $3 OFFSET $4`,
    [productId, userId, limit, offset]
  );
  return rows;
}

/** La reseña propia, aunque esté oculta (para que la persona sepa que existe). */
export async function findMine(productId: string, userId: string) {
  const { rows } = await pool.query<ReviewRow>(
    `SELECT ${COLUMNS("$2")} FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND r.user_id = $2`,
    [productId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Crear o editar en UNA sentencia (upsert): el UNIQUE (product_id, user_id) de la tabla
 * garantiza una reseña por persona; si ya existe, se actualiza.
 * is_hidden NO se toca al editar: si el admin la ocultó, editarla no la vuelve a mostrar.
 */
export async function upsert(productId: string, userId: string, r: ReviewInput) {
  await pool.query(
    `INSERT INTO reviews (product_id, user_id, rating, title, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title, comment = EXCLUDED.comment`,
    [productId, userId, r.rating, r.title, r.comment]
  );
}

export async function removeMine(productId: string, userId: string) {
  const { rowCount } = await pool.query("DELETE FROM reviews WHERE product_id = $1 AND user_id = $2", [productId, userId]);
  return rowCount === 1;
}

// ------------------------------------------------ admin

export async function adminList(status: "all" | "visible" | "hidden", limit: number, offset: number) {
  const filter = status === "visible" ? "WHERE NOT r.is_hidden" : status === "hidden" ? "WHERE r.is_hidden" : "";
  const { rows } = await pool.query<ReviewRow & { productName: string; productSlug: string; userEmail: string; total: number }>(
    `SELECT ${COLUMNS("NULL")}, p.name AS "productName", p.slug AS "productSlug", u.email AS "userEmail",
            COUNT(*) OVER()::int AS total
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ${filter}
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function setHidden(id: string, isHidden: boolean) {
  const { rowCount } = await pool.query("UPDATE reviews SET is_hidden = $2 WHERE id = $1", [id, isHidden]);
  return rowCount === 1;
}
