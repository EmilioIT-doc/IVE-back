import { pool, type DbClient } from "../../db.js";
import { framingSql, type Framing } from "../../lib/framing.js";
import type { CategoryInput } from "./categories.schemas.js";

type Db = DbClient | typeof pool;

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
  coverFraming: Framing;
  position: number;
  isActive: boolean;
  productCount: number; // todos los productos, visibles u ocultos
  activeProductCount: number; // los que se ven en la tienda
};

const SELECT = `
  SELECT c.id, c.name, c.slug, c.cover_url AS "coverUrl",
         ${framingSql("c.cover_zoom", "c.cover_focus_x", "c.cover_focus_y")} AS "coverFraming", c.position, c.is_active AS "isActive",
         COUNT(p.id)::int AS "productCount",
         COUNT(p.id) FILTER (WHERE p.is_active)::int AS "activeProductCount"
  FROM categories c
  LEFT JOIN products p ON p.category_id = c.id`;

export async function list(db: Db = pool) {
  const { rows } = await db.query<AdminCategory>(`${SELECT} GROUP BY c.id ORDER BY c.position, c.id`);
  return rows;
}

export async function find(db: Db, id: string) {
  const { rows } = await db.query<AdminCategory>(`${SELECT} WHERE c.id = $1 GROUP BY c.id`, [id]);
  return rows[0] ?? null;
}

export async function slugExists(db: Db, slug: string, exceptId?: string) {
  const { rows } = await db.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM categories WHERE slug = $1 AND id IS DISTINCT FROM $2::bigint) AS exists",
    [slug, exceptId ?? null]
  );
  return rows[0]!.exists;
}

/** Las nuevas van al final de la lista. */
export async function insert(db: Db, c: CategoryInput & { slug: string }) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO categories (name, slug, is_active, position)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position) + 1, 0) FROM categories))
     RETURNING id`,
    [c.name, c.slug, c.isActive]
  );
  return rows[0]!.id;
}

export async function update(db: Db, id: string, c: Partial<CategoryInput>) {
  const columns: Record<string, unknown> = { name: c.name, slug: c.slug, is_active: c.isActive };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.query(`UPDATE categories SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
}

export async function reorder(db: Db, ids: string[]) {
  await db.query(
    `UPDATE categories AS c SET position = o.position
     FROM UNNEST($1::bigint[], $2::int[]) AS o(id, position)
     WHERE c.id = o.id`,
    [ids, ids.map((_, i) => i)]
  );
}

export async function remove(db: Db, id: string) {
  const { rows } = await db.query<{ coverUrl: string | null }>(
    `DELETE FROM categories WHERE id = $1 RETURNING cover_url AS "coverUrl"`,
    [id]
  );
  return rows[0] ?? null;
}

/** Bloquea la fila (FOR UPDATE) y regresa la portada actual. */
export async function lockCover(db: Db, id: string) {
  const { rows } = await db.query<{ coverUrl: string | null }>(
    `SELECT cover_url AS "coverUrl" FROM categories WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

/** Cambia (o quita) la portada. Una foto nueva arranca con el encuadre por defecto. */
export async function setCover(db: Db, id: string, url: string | null) {
  await db.query(
    "UPDATE categories SET cover_url = $2, cover_zoom = 1, cover_focus_x = 50, cover_focus_y = 50 WHERE id = $1",
    [id, url]
  );
}

export async function setCoverFraming(db: Db, id: string, f: Framing) {
  await db.query(
    "UPDATE categories SET cover_zoom = $2, cover_focus_x = $3, cover_focus_y = $4 WHERE id = $1",
    [id, f.zoom, f.x, f.y]
  );
}
