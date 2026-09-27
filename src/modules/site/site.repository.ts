import { pool, type DbClient } from "../../db.js";
import { framingSql, type Framing } from "../../lib/framing.js";

type Db = DbClient | typeof pool;

export type SiteImage = { slot: string; url: string | null; altText: string | null; framing: Framing; updatedAt: Date };

const COLUMNS = `slot, url, alt_text AS "altText", ${framingSql("zoom", "focus_x", "focus_y")} AS framing, updated_at AS "updatedAt"`;

export async function list(db: Db = pool) {
  const { rows } = await db.query<SiteImage>(
    `SELECT ${COLUMNS} FROM site_images ORDER BY slot`
  );
  return rows;
}

export async function find(db: Db, slot: string) {
  const { rows } = await db.query<SiteImage>(
    `SELECT ${COLUMNS} FROM site_images WHERE slot = $1`,
    [slot]
  );
  return rows[0] ?? null;
}

/** Bloquea el lugar (FOR UPDATE) y regresa la foto actual, para reemplazarla sin carreras. */
export async function lock(db: Db, slot: string) {
  const { rows } = await db.query<{ url: string | null }>("SELECT url FROM site_images WHERE slot = $1 FOR UPDATE", [slot]);
  return rows[0] ?? null;
}

/** Cambia (o quita) la foto. Una foto nueva arranca con el encuadre por defecto. */
export async function setUrl(db: Db, slot: string, url: string | null) {
  await db.query("UPDATE site_images SET url = $2, zoom = 1, focus_x = 50, focus_y = 50 WHERE slot = $1", [slot, url]);
}

export async function setFraming(db: Db, slot: string, f: Framing) {
  await db.query("UPDATE site_images SET zoom = $2, focus_x = $3, focus_y = $4 WHERE slot = $1", [slot, f.zoom, f.x, f.y]);
}

export async function setAlt(db: Db, slot: string, altText: string | null) {
  await db.query("UPDATE site_images SET alt_text = $2 WHERE slot = $1", [slot, altText]);
}
