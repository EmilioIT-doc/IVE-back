import { z } from "zod";
import { idParam } from "../../lib/params.js";

const quantity = z.number().int().min(1, "Mínimo 1").max(20, "Máximo 20 piezas por artículo");

export const addItemSchema = z.object({ variantId: idParam, quantity: quantity.default(1) });
export const updateItemSchema = z.object({ quantity });
export const mergeSchema = z.object({
  items: z.array(z.object({ variantId: idParam, quantity })).max(50),
});
