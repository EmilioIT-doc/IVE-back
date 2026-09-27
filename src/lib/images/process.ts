import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import heicConvert from "heic-convert";
import sharp from "sharp";
import { PRODUCT_UPLOADS_DIR } from "../uploads.js";
import type { ImageKind } from "./sniff.js";

// Sin caché: en Windows la caché de sharp deja el archivo original abierto
// y luego no se puede borrar el temporal.
sharp.cache(false);

/** Lado más largo de la foto final. 2400 px alcanza para el zoom de la ficha (2.5x). */
const MAX_SIDE = 2400;
/** Protección contra "bombas" de píxeles: una imagen chiquita en MB pero de 50,000 x 50,000. */
const MAX_INPUT_PIXELS = 300_000_000; // ~17,000 x 17,000

export type ProcessedImage = { filename: string; width: number; height: number; bytes: number };

/**
 * Convierte cualquier imagen soportada en un WebP listo para la web:
 * - respeta la rotación del celular (EXIF) y luego borra los metadatos (GPS, cámara…)
 * - la reduce a máximo 2400 px sin agrandar las chicas
 * - la pasa a sRGB (las TIFF en CMYK de imprenta se verían raras en el navegador)
 * Una foto de 90 MB suele quedar en 300-900 KB.
 */
export async function processImage(inputPath: string, kind: ImageKind): Promise<ProcessedImage> {
  // HEIC (fotos de iPhone): sharp no trae el decodificador HEVC por patentes,
  // así que primero la pasamos a JPEG de alta calidad con heic-convert.
  const input = kind === "heic" ? await decodeHeic(inputPath) : inputPath;

  const filename = `${crypto.randomUUID()}.webp`;
  const output = path.join(PRODUCT_UPLOADS_DIR, filename);
  try {
    const info = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .toColorspace("srgb")
      .webp({ quality: 85, effort: 4 })
      .toFile(output);
    return { filename, width: info.width, height: info.height, bytes: info.size };
  } catch (err) {
    await fs.promises.unlink(output).catch(() => undefined);
    throw err;
  }
}

async function decodeHeic(inputPath: string): Promise<Buffer> {
  const buffer = await fs.promises.readFile(inputPath);
  const jpeg = await heicConvert({ buffer, format: "JPEG", quality: 0.95 });
  return Buffer.from(jpeg);
}
