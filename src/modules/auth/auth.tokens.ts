import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { PublicUser } from "./auth.repository.js";

export type AccessTokenPayload = { sub: string; role: PublicUser["role"] };

/** JWT de acceso: corto (15 min), firmado con el secreto del .env. */
export function signAccessToken(user: Pick<PublicUser, "id" | "role">): string {
  const payload: AccessTokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** Lanza un error si el token es inválido o ya expiró. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new jwt.JsonWebTokenError("Payload inválido");
  }
  return { sub: decoded.sub, role: decoded.role === "admin" ? "admin" : "customer" };
}

/**
 * Refresh token: NO es un JWT, es una cadena aleatoria.
 * Al cliente le damos el token; en la base guardamos solo su hash SHA-256.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Sin "recordarme" la sesión dura 1 día; con él, REFRESH_TOKEN_DAYS. */
export function refreshExpiryDate(remember: boolean): Date {
  const days = remember ? env.REFRESH_TOKEN_DAYS : 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
