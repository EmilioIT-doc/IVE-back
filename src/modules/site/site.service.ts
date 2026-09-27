import { z } from "zod";
import { pool, withTransaction } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import type { Framing } from "../../lib/framing.js";
import { deleteUploadedFile } from "../../lib/uploads.js";
import * as repo from "./site.repository.js";

/** Los lugares que existen hoy. Para agregar otro: migración con su fila + este enum. */
export const slotParam = z.enum(["home_hero", "home_editorial"], { message: "Lugar de foto inválido" });
export const altSchema = z.object({ altText: z.string().trim().max(200).nullable() });

const notFound = () => new AppError(404, "SLOT_NOT_FOUND", "Lugar de foto no encontrado");

/** { home_hero: { url, altText }, home_editorial: {…} } — cómodo para el front */
function toMap(rows: repo.SiteImage[]) {
  return Object.fromEntries(rows.map((r) => [r.slot, { url: r.url, altText: r.altText, framing: r.framing, updatedAt: r.updatedAt }]));
}

export async function all() {
  return toMap(await repo.list());
}

export async function updateAlt(slot: string, altText: string | null) {
  if (!(await repo.find(pool, slot))) throw notFound();
  await repo.setAlt(pool, slot, altText || null);
  return all();
}

/** Guarda zoom y posición (la foto no se toca). */
export async function updateFraming(slot: string, framing: Framing) {
  const image = await repo.find(pool, slot);
  if (!image) throw notFound();
  if (!image.url) throw new AppError(409, "NO_IMAGE", "Primero sube una foto");
  await repo.setFraming(pool, slot, framing);
  return all();
}

export async function removeImage(slot: string) {
  const old = await withTransaction(async (db) => {
    const current = await repo.lock(db, slot);
    if (!current) throw notFound();
    await repo.setUrl(db, slot, null);
    return current.url;
  });
  if (old) await deleteUploadedFile(old); // después del COMMIT
  return all();
}
