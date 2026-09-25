import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug inválido");

/** "M,L,XL" → ["M", "L", "XL"] */
const csvList = (maxItemLength: number) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((t) => t.trim()).filter(Boolean) : []))
    .pipe(z.array(z.string().max(maxItemLength)).max(20));

export const listProductsQuery = z
  .object({
    category: slug.optional(),
    size: csvList(10),
    color: csvList(30),
    minPriceCents: z.coerce.number().int().min(0).optional(),
    maxPriceCents: z.coerce.number().int().min(0).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .refine((f) => f.minPriceCents === undefined || f.maxPriceCents === undefined || f.minPriceCents <= f.maxPriceCents, {
    message: "El precio mínimo no puede ser mayor al máximo",
    path: ["minPriceCents"],
  });

export type ListProductsFilters = z.infer<typeof listProductsQuery>;

export const slugParam = slug;

export const relatedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(4),
});
