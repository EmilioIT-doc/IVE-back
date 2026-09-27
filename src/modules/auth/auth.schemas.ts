import { z } from "zod";
import { addressInputSchema } from "../addresses/addresses.schemas.js";

// Las MISMAS reglas que usa el front en el registro (defensa en profundidad).
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Escribe un correo válido" }));

const nameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,50}$/, "Solo letras, de 2 a 50 caracteres");

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[a-z]/, "Debe incluir una minúscula")
  .regex(/\d/, "Debe incluir un número")
  .regex(/[^A-Za-z0-9]/, "Debe incluir un símbolo");

export const checkEmailSchema = z.object({ email: emailSchema });

/** Celular de México: 10 dígitos (se aceptan espacios y guiones al escribirlo). */
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{10}$/, "El celular debe tener 10 dígitos"));

/** "AAAA-MM-DD", fecha real y edad entre 13 y 120 años. */
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s); // descarta 2001-02-30
  }, "Esa fecha no existe")
  .refine((s) => {
    const years = (Date.now() - new Date(`${s}T00:00:00Z`).getTime()) / (365.25 * 24 * 3600 * 1000);
    return years >= 13 && years <= 120;
  }, "Debes tener al menos 13 años");

export const channelSchema = z.enum(["email", "sms"]);
export const codeSchema = z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos");

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  birthDate: birthDateSchema,
  address: addressInputSchema.omit({ isDefault: true }), // se guarda como su dirección principal
  channel: channelSchema, // por dónde le mandamos el código
});

export const verifySchema = z.object({ email: emailSchema, code: codeSchema });
export const resendSchema = z.object({ email: emailSchema, channel: channelSchema });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña"),
  remember: z.boolean().optional().default(false),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type Channel = z.infer<typeof channelSchema>;
