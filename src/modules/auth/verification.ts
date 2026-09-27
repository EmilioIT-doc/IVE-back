import crypto from "node:crypto";
import { pool, type DbClient } from "../../db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { sendMail } from "../../lib/messaging/mailer.js";
import { sendSms } from "../../lib/messaging/sms.js";
import { verificationEmail, verificationSms } from "../../lib/messaging/templates.js";
import type { VerifiableUser } from "./auth.repository.js";
import type { Channel } from "./auth.schemas.js";

/**
 * Códigos de verificación de 6 dígitos (correo o SMS).
 * Reglas anti-abuso:
 *  - vencen en 10 minutos
 *  - 60 s de espera entre reenvíos, máximo 5 envíos por hora
 *  - máximo 5 intentos por código
 *  - se guarda solo el HASH del código (si alguien roba la base, no ve códigos)
 */
export const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_S = 60;
const MAX_SENDS_PER_HOUR = 5;
export const MAX_ATTEMPTS = 5;

type Db = DbClient | typeof pool;

/** Hash con "pimienta" (el secreto del servidor): sin él, ni 1,000,000 de intentos sirven offline. */
export const hashCode = (userId: string, code: string) =>
  crypto.createHash("sha256").update(`${userId}:${code}:${env.JWT_ACCESS_SECRET}`).digest("hex");

export function codesMatch(userId: string, code: string, storedHash: string) {
  const a = Buffer.from(hashCode(userId, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b); // comparación en tiempo constante
}

export const maskEmail = (email: string) => {
  const [user, domain] = email.split("@") as [string, string];
  // "emilio@gmail.com" → "e••••o@gmail.com" (máximo 4 puntos: no delata el largo)
  return `${user.slice(0, 1)}${"•".repeat(Math.min(4, Math.max(1, user.length - 2)))}${user.length > 1 ? user.slice(-1) : ""}@${domain}`;
};
export const maskPhone = (phone: string) => `•••• ${phone.slice(-4)}`;

/** Crea un código nuevo (invalida los anteriores). Revisa los límites de envío. */
export async function issueCode(db: Db, user: VerifiableUser, channel: Channel) {
  if (channel === "sms" && !user.phone) throw new AppError(400, "NO_PHONE", "Tu cuenta no tiene celular registrado");

  const { rows: recent } = await db.query<{ createdAt: Date }>(
    `SELECT created_at AS "createdAt" FROM verification_codes
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC`,
    [user.id]
  );
  const last = recent[0]?.createdAt;
  if (last) {
    const wait = Math.ceil(RESEND_COOLDOWN_S - (Date.now() - last.getTime()) / 1000);
    if (wait > 0) throw new AppError(429, "RESEND_TOO_SOON", `Espera ${wait} s para pedir otro código`, { retryAfterSeconds: wait });
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    throw new AppError(429, "TOO_MANY_CODES", "Pediste muchos códigos. Intenta de nuevo en una hora");
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const destination = channel === "email" ? user.email : user.phone!;
  await db.query("UPDATE verification_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL", [user.id]);
  const { rows } = await db.query<{ expiresAt: Date; createdAt: Date }>(
    `INSERT INTO verification_codes (user_id, channel, destination, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)
     RETURNING expires_at AS "expiresAt", created_at AS "createdAt"`,
    [user.id, channel, destination, hashCode(user.id, code), String(CODE_TTL_MINUTES)]
  );
  const saved = rows[0]!;
  return {
    code,
    info: {
      email: user.email,
      channel,
      destination: channel === "email" ? maskEmail(destination) : maskPhone(destination),
      expiresAt: saved.expiresAt,
      resendAvailableAt: new Date(saved.createdAt.getTime() + RESEND_COOLDOWN_S * 1000),
      canUseSms: !!user.phone,
    },
  };
}

export type VerificationInfo = Awaited<ReturnType<typeof issueCode>>["info"];

/**
 * Manda el código. Se llama DESPUÉS del COMMIT (si falla el correo, la cuenta ya existe
 * y la persona puede pedir otro). En desarrollo también se imprime en la terminal.
 */
export async function deliverCode(user: VerifiableUser, channel: Channel, code: string) {
  if (env.NODE_ENV !== "production") console.log(`🔑 Código de verificación para ${user.email}: ${code}`);
  try {
    if (channel === "sms") {
      await sendSms(user.phone!, verificationSms(code, CODE_TTL_MINUTES));
    } else {
      const mail = verificationEmail(user.firstName, code, CODE_TTL_MINUTES);
      await sendMail(user.email, mail.subject, mail.html, mail.text);
    }
    return true;
  } catch (err) {
    console.error(`No se pudo enviar el código por ${channel}:`, (err as Error).message);
    return false;
  }
}

/** El código vigente (el más nuevo sin usar), bloqueado para contar intentos sin carreras. */
export async function findActiveCodeForUpdate(db: DbClient, userId: string) {
  const { rows } = await db.query<{ id: string; codeHash: string; attempts: number; expiresAt: Date }>(
    `SELECT id, code_hash AS "codeHash", attempts, expires_at AS "expiresAt"
     FROM verification_codes
     WHERE user_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1
     FOR UPDATE`,
    [userId]
  );
  return rows[0] ?? null;
}
