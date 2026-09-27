import argon2 from "argon2";
import { pool, withTransaction, isUniqueViolation, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import * as repo from "./auth.repository.js";
import type { PublicUser } from "./auth.repository.js";
import type { Channel, LoginInput, RegisterInput } from "./auth.schemas.js";
import * as addressesService from "../addresses/addresses.service.js";
import { deliverCode, findActiveCodeForUpdate, codesMatch, issueCode, MAX_ATTEMPTS, type VerificationInfo } from "./verification.js";
import { generateRefreshToken, hashToken, refreshExpiryDate, signAccessToken } from "./auth.tokens.js";

export type Session = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  remember: boolean;
};

// Hash "de mentira" para comparar cuando el correo no existe.
// Así el login tarda lo mismo exista o no el usuario, y nadie puede
// adivinar qué correos están registrados midiendo el tiempo de respuesta.
const dummyHashPromise = argon2.hash("contraseña-que-nunca-coincide");

async function createSession(user: PublicUser, remember: boolean, db: DbClient | typeof pool = pool): Promise<Session> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = refreshExpiryDate(remember);
  await repo.insertRefreshToken(db, {
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
    remember,
  });
  return { user, accessToken: signAccessToken(user), refreshToken, refreshExpiresAt, remember };
}

export async function checkEmail(email: string) {
  return { available: !(await repo.emailExists(email)) };
}

/**
 * Registro: crea la cuenta SIN verificar + su dirección principal + un código.
 * No inicia sesión: primero hay que confirmar el código (así solo entran personas reales).
 */
export async function register(input: RegisterInput): Promise<VerificationInfo> {
  const passwordHash = await argon2.hash(input.password);

  try {
    const { user, code, info } = await withTransaction(async (client) => {
      const created = await repo.createUser(client, {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        birthDate: input.birthDate,
      });
      await addressesService.create(created.id, { ...input.address, isDefault: true }, client);
      const user = { ...created, verifiedAt: null };
      const issued = await issueCode(client, user, input.channel);
      return { user, ...issued };
    });
    // Fuera de la transacción: mandar un correo no debe dejar filas bloqueadas
    await deliverCode(user, input.channel, code);
    return info;
  } catch (err) {
    // Dos registros simultáneos con el mismo correo: el UNIQUE de la base decide.
    if (isUniqueViolation(err)) {
      throw new AppError(409, "EMAIL_TAKEN", "Ya existe una cuenta con este correo");
    }
    throw err;
  }
}

export async function login(input: LoginInput): Promise<Session> {
  const found = await repo.findUserWithHashByEmail(input.email);
  const hash = found?.passwordHash ?? (await dummyHashPromise);
  const valid = await argon2.verify(hash, input.password);

  if (!found || !valid) {
    // Mismo mensaje para "no existe" y "contraseña incorrecta".
    throw new AppError(401, "INVALID_CREDENTIALS", "El correo o la contraseña no son correctos");
  }
  // Contraseña correcta pero cuenta sin confirmar: el front ofrece mandar un código
  if (!found.verifiedAt) {
    throw new AppError(403, "ACCOUNT_NOT_VERIFIED", "Confirma tu cuenta con el código que te enviamos", {
      email: found.email,
      canUseSms: !!found.phone,
    });
  }

  const { passwordHash: _omit, verifiedAt: _v, ...user } = found;
  return createSession(user, input.remember);
}

/**
 * Rotación de refresh token: cada uso invalida el token y entrega uno nuevo.
 * Si alguien presenta un token YA revocado, es señal de robo:
 * se revocan todas las sesiones de ese usuario.
 */
export async function refresh(rawToken: string | undefined): Promise<Session> {
  if (!rawToken) throw new AppError(401, "NO_REFRESH_TOKEN", "No hay sesión");

  const result = await withTransaction(async (client) => {
    const stored = await repo.findRefreshTokenForUpdate(client, hashToken(rawToken));
    if (!stored) return { error: "INVALID" as const };

    if (stored.revokedAt) {
      await repo.revokeAllUserTokens(client, stored.userId);
      return { error: "REUSED" as const };
    }
    if (stored.expiresAt.getTime() <= Date.now()) return { error: "EXPIRED" as const };

    const user = await repo.findUserById(stored.userId, client);
    if (!user) return { error: "INVALID" as const };

    await repo.revokeRefreshToken(client, stored.id);
    return { session: await createSession(user, stored.remember, client) };
  });

  if ("error" in result) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Tu sesión expiró, vuelve a iniciar sesión");
  }
  return result.session;
}

export async function logout(rawToken: string | undefined) {
  if (rawToken) await repo.revokeRefreshTokenByHash(hashToken(rawToken));
}

export async function me(userId: string): Promise<PublicUser> {
  const user = await repo.findUserById(userId);
  if (!user) throw new AppError(401, "UNAUTHORIZED", "No hay sesión");
  return user;
}

// ---------------------------------------------------------------- verificación

/** Reenviar (o mandar por otro medio) el código. */
export async function resendCode(email: string, channel: Channel): Promise<VerificationInfo> {
  const { user, code, info } = await withTransaction(async (client) => {
    const user = await repo.findVerifiableByEmail(client, email, true); // FOR UPDATE: un reenvío a la vez
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "No hay una cuenta con ese correo");
    if (user.verifiedAt) throw new AppError(409, "ALREADY_VERIFIED", "Tu cuenta ya está confirmada: inicia sesión");
    return { user, ...(await issueCode(client, user, channel)) };
  });
  await deliverCode(user, channel, code);
  return info;
}

/**
 * Confirma el código → marca la cuenta como verificada e inicia sesión.
 * Los intentos fallidos se GUARDAN aunque respondamos error: por eso la transacción
 * regresa un resultado y lanzamos el error ya afuera (si lo lanzáramos adentro, el
 * ROLLBACK borraría el +1 de intentos y se podría adivinar el código sin límite).
 */
export async function verify(email: string, code: string): Promise<Session> {
  const result = await withTransaction(async (client) => {
    const user = await repo.findVerifiableByEmail(client, email, true);
    if (!user) return { error: new AppError(400, "INVALID_CODE", "El código no es correcto") };
    if (user.verifiedAt) return { error: new AppError(409, "ALREADY_VERIFIED", "Tu cuenta ya está confirmada: inicia sesión") };

    const active = await findActiveCodeForUpdate(client, user.id);
    if (!active || active.expiresAt.getTime() <= Date.now()) {
      return { error: new AppError(400, "CODE_EXPIRED", "El código venció. Pide uno nuevo") };
    }
    if (active.attempts >= MAX_ATTEMPTS) {
      return { error: new AppError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos. Pide un código nuevo") };
    }
    if (!codesMatch(user.id, code, active.codeHash)) {
      await client.query("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1", [active.id]);
      const remaining = MAX_ATTEMPTS - active.attempts - 1;
      return {
        error: new AppError(400, "INVALID_CODE", remaining > 0 ? `El código no es correcto. Te quedan ${remaining} intentos` : "Demasiados intentos. Pide un código nuevo", {
          remainingAttempts: remaining,
        }),
      };
    }

    await client.query("UPDATE verification_codes SET consumed_at = NOW() WHERE id = $1", [active.id]);
    await repo.markVerified(client, user.id);
    const { verifiedAt: _v, ...publicUser } = user;
    return { session: await createSession(publicUser, true, client) };
  });

  if ("error" in result) throw result.error;
  return result.session;
}
