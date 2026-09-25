import argon2 from "argon2";
import { pool, withTransaction, isUniqueViolation, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import * as repo from "./auth.repository.js";
import type { PublicUser } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
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

export async function register(input: RegisterInput): Promise<Session> {
  const passwordHash = await argon2.hash(input.password);

  try {
    return await withTransaction(async (client) => {
      const user = await repo.createUser(client, {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      });
      // Al registrarse, la sesión queda iniciada (así lo pide el diseño).
      return createSession(user, true, client);
    });
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

  const { passwordHash: _omit, ...user } = found;
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
