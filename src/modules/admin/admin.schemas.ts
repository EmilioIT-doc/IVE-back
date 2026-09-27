import { z } from "zod";
import { idParam } from "../../lib/params.js";

const money = z.number().int("En centavos, sin decimales").min(0).max(10_000_000);

export const genderSchema = z.enum(["unisex", "hombre", "mujer"]);

// Sin .default() aquí: en Zod 4, .partial() conserva los defaults y un PATCH
// que solo cambia el nombre terminaría "reseteando" isActive y gender.
const productFields = z.object({
  categoryId: idParam,
  gender: genderSchema,
  name: z.string().trim().min(2, "Escribe el nombre").max(120),
  // Opcional: si no viene, se genera a partir del nombre
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
    .optional(),
  description: z.string().trim().max(2000).nullish(),
  priceCents: money,
  // Precio "antes" (tachado). null = sin oferta. Debe ser mayor que priceCents (se valida en el servicio)
  compareAtCents: money.nullable(),
  isActive: z.boolean(),
});

export const productInputSchema = productFields.extend({
  compareAtCents: money.nullable().default(null),
  gender: genderSchema.default("unisex"),
  isActive: z.boolean().default(true),
});

export const productUpdateSchema = productFields.partial();

export const variantInputSchema = z.object({
  id: idParam.optional(), // si viene, se actualiza; si no, se crea
  size: z.string().trim().min(1).max(10),
  color: z.string().trim().toLowerCase().min(2).max(30),
  stock: z.number().int().min(0).max(100_000),
  priceCents: money.nullish(), // null = usa el precio del producto
  isActive: z.boolean().default(true),
});

export const variantsSyncSchema = z
  .object({ variants: z.array(variantInputSchema).max(200) })
  .refine(
    (v) => {
      const keys = v.variants.map((x) => `${x.size}|${x.color}`);
      return new Set(keys).size === keys.length;
    },
    { message: "Hay combinaciones de talla y color repetidas", path: ["variants"] }
  );

export const createProductSchema = productInputSchema.extend({
  variants: z.array(variantInputSchema.omit({ id: true })).max(200).default([]),
});

export const reorderImagesSchema = z.object({ ids: z.array(idParam).min(1).max(50) });

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
