import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.number().int("Elige de 1 a 5 estrellas").min(1, "Elige de 1 a 5 estrellas").max(5, "Elige de 1 a 5 estrellas"),
  title: z.string().trim().max(80, "Máximo 80 caracteres").nullish().transform((s) => s || null),
  comment: z.string().trim().max(2000, "Máximo 2000 caracteres").nullish().transform((s) => s || null),
});

export const listReviewsQuery = z.object({
  sort: z.enum(["recent", "best", "worst"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const adminReviewsQuery = z.object({
  status: z.enum(["all", "visible", "hidden"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

export const moderateSchema = z.object({ isHidden: z.boolean() });

export type ReviewInput = z.infer<typeof reviewInputSchema>;
