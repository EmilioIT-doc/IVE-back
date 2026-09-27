import fs from "node:fs";
import path from "node:path";

/** Carpeta raíz de archivos subidos (se sirve en /uploads). */
export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
/** Fotos ya procesadas (WebP) que ve la tienda. */
export const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, "products");
/** Archivos a medio subir. NO se sirve al público. */
export const TMP_UPLOADS_DIR = path.join(process.cwd(), "tmp", "uploads");

fs.mkdirSync(PRODUCT_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });

/** Máximo por archivo. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
/** Tamaño de cada pedazo que manda el front. */
export const CHUNK_BYTES = 8 * 1024 * 1024; // 8 MB
/** Máximo de archivos por lote. */
export const MAX_FILES_PER_BATCH = 20;

/**
 * Ruta del archivo temporal de una sesión de subida.
 * El nombre es el UUID de la sesión (ya validado), nunca el nombre que manda el usuario.
 */
export const tmpPathFor = (uploadId: string) => path.join(TMP_UPLOADS_DIR, `${uploadId}.part`);

export async function removeTmp(uploadId: string) {
  await fs.promises.unlink(tmpPathFor(uploadId)).catch(() => undefined);
}

/** URL pública de un archivo procesado: /uploads/products/<archivo> */
export const publicUrlFor = (filename: string) => `/uploads/products/${filename}`;

/** Borra del disco una foto subida (solo si vive en /uploads; las de /products del front no se tocan). */
export async function deleteUploadedFile(url: string) {
  if (!url.startsWith("/uploads/products/")) return;
  const file = path.join(PRODUCT_UPLOADS_DIR, path.basename(url));
  await fs.promises.unlink(file).catch(() => undefined);
}
