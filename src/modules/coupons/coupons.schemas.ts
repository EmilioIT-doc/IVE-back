import { z } from "zod";

/** "verano25" → "VERANO25". Solo letras, números, guion y guion bajo. */
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/, "El código lleva de 3 a 30 letras o números (sin espacios)");

const isoDate = z.iso.datetime({ offset: true, message: "Fecha inválida" });

export const createCouponSchema = z
  .object({
    code: couponCodeSchema,
    description: z.string().trim().max(200).nullish(),
    discountType: z.enum(["percent", "fixed"]),
    // percent → 1..100 · fixed → centavos
    discountValue: z.number().int().positive(),
    minSubtotalCents: z.number().int().min(0).default(0),
    maxUses: z.number().int().positive().nullish(),
    perUserLimit: z.number().int().positive().nullish(),
    startsAt: isoDate.nullish(),
    endsAt: isoDate.nullish(),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.discountType !== "percent" || c.discountValue <= 100, {
    message: "Un porcentaje va de 1 a 100",
    path: ["discountValue"],
  })
  .refine((c) => !c.startsAt || !c.endsAt || new Date(c.endsAt) > new Date(c.startsAt), {
    message: "La fecha de fin debe ser después del inicio",
    path: ["endsAt"],
  });

export const updateCouponSchema = z.object({ isActive: z.boolean() });

export const previewCouponSchema = z.object({ code: couponCodeSchema });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
