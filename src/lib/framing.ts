import { z } from "zod";

/**
 * Encuadre de una portada: zoom + punto de enfoque (ver migración 019).
 * Se guarda en la base y el front lo aplica con CSS; el archivo nunca se modifica.
 */
export const framingSchema = z.object({
  zoom: z.number().min(1).max(3),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export type Framing = z.infer<typeof framingSchema>;

/** Arma { zoom, x, y } en SQL, listo para el JSON de la respuesta. */
export const framingSql = (zoom: string, x: string, y: string) => `json_build_object('zoom', ${zoom}, 'x', ${x}, 'y', ${y})`;
