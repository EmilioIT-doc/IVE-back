import { z } from "zod";

const text = (max: number, message = "Campo requerido") => z.string().trim().min(1, message).max(max);

// Mismas reglas que las CHECK de la tabla addresses (teléfono 10 dígitos, CP 5 dígitos)
export const addressInputSchema = z.object({
  recipientName: text(100, "Escribe el nombre de quien recibe"),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "")) // "55 1234-5678" → "5512345678"
    .pipe(z.string().regex(/^\d{10}$/, "El teléfono debe tener 10 dígitos")),
  street: text(150),
  extNumber: text(20),
  intNumber: z
    .string()
    .trim()
    .max(20)
    .nullish()
    .transform((s) => (s ? s : null)),
  neighborhood: text(100),
  city: text(100),
  state: text(100),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Escribe los 5 dígitos del código postal"),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
