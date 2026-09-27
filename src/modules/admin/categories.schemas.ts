import { z } from "zod";
import { idParam } from "../../lib/params.js";

/**
 * Slugs que la tienda ya usa como "para quién" (/tienda/mujer, /tienda/hombre, /tienda/unisex).
 * Una categoría con ese slug chocaría con esas páginas.
 */
export const RESERVED_SLUGS = ["mujer", "hombre", "unisex"];

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
  .refine((s) => !RESERVED_SLUGS.includes(s), "Ese slug está reservado (mujer, hombre y unisex ya son páginas de la tienda)");

const categoryFields = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(40, "Máximo 40 caracteres"),
  slug: slug.optional(), // si no viene, se genera a partir del nombre
  isActive: z.boolean(),
});

export const createCategorySchema = categoryFields.extend({ isActive: z.boolean().default(true) });
export const updateCategorySchema = categoryFields.partial();
export const reorderCategoriesSchema = z.object({ ids: z.array(idParam).min(1).max(100) });

export type CategoryInput = z.infer<typeof createCategorySchema>;
