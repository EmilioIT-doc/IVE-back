import { z } from "zod";
import { idParam } from "../../lib/params.js";
import { addressInputSchema } from "../addresses/addresses.schemas.js";
import { couponCodeSchema } from "../coupons/coupons.schemas.js";

export const createOrderSchema = z
  .object({
    // O una dirección guardada, o una nueva escrita en el checkout
    addressId: idParam.optional(),
    address: addressInputSchema.optional(),
    saveAddress: z.boolean().optional().default(false),
    shippingMethod: z.enum(["standard", "express"]).default("standard"),
    paymentToken: z.string().regex(/^tok_[a-z_]+$/, "Token de pago inválido"),
    couponCode: couponCodeSchema.optional(), // se vuelve a validar aquí: el front solo lo muestra
  })
  .refine((d) => (d.addressId ? !d.address : !!d.address), {
    message: "Manda addressId o address (solo uno)",
    path: ["address"],
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Header Idempotency-Key: el front genera uno por intento de compra (crypto.randomUUID()). */
export const idempotencyKeySchema = z
  .string({ message: "Falta el header Idempotency-Key" })
  .regex(/^[A-Za-z0-9_-]{16,100}$/, "Idempotency-Key inválida");
