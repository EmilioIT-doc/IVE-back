/**
 * Detecta el tipo REAL de una imagen leyendo sus primeros bytes ("magic bytes").
 * No confiamos en la extensión ni en el Content-Type: cualquiera puede renombrar
 * un .exe a foto.jpg. Los formatos de imagen empiezan con firmas conocidas.
 */
export type ImageKind = "jpeg" | "png" | "gif" | "webp" | "tiff" | "avif" | "heic";

/** Bytes que hace falta leer para reconocer cualquier formato soportado. */
export const SNIFF_BYTES = 64;

const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"]);
const AVIF_BRANDS = new Set(["avif", "avis"]);

export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  const ascii = (start: number, end: number) => buf.toString("latin1", start, end);

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  // TIFF: "II*\0" (Intel) o "MM\0*" (Motorola); 0x2b = BigTIFF
  if ((ascii(0, 2) === "II" && (buf[2] === 0x2a || buf[2] === 0x2b) && buf[3] === 0) ||
      (ascii(0, 2) === "MM" && buf[2] === 0 && (buf[3] === 0x2a || buf[3] === 0x2b))) return "tiff";

  // HEIC y AVIF son "cajas" ISO: bytes 4-8 = "ftyp", luego la marca principal y las compatibles
  if (ascii(4, 8) === "ftyp") {
    const boxSize = Math.min(buf.readUInt32BE(0), buf.length);
    const brands = [ascii(8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(i, i + 4));
    if (brands.some((b) => AVIF_BRANDS.has(b))) return "avif";
    if (brands.some((b) => HEIC_BRANDS.has(b))) return "heic";
  }
  return null;
}
