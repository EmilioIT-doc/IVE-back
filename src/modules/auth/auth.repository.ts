import { pool, type DbClient } from "../../db.js";

// Lo que SÍ se puede mandar al cliente (nunca el password_hash).
export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "customer" | "admin";
};

// Los alias "firstName" convierten snake_case (SQL) a camelCase (JS).
const PUBLIC_USER_COLUMNS = `
  id, email, first_name AS "firstName", last_name AS "lastName", role
`;

export async function emailExists(email: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1) AS exists",
    [email]
  );
  return rows[0]?.exists ?? false;
}

export async function findUserWithHashByEmail(email: string) {
  const { rows } = await pool.query<PublicUser & { passwordHash: string }>(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash AS "passwordHash"
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string, db: DbClient | typeof pool = pool) {
  const { rows } = await db.query<PublicUser>(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createUser(
  db: DbClient,
  data: { email: string; passwordHash: string; firstName: string; lastName: string }
) {
  const { rows } = await db.query<PublicUser>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [data.email, data.passwordHash, data.firstName, data.lastName]
  );
  return rows[0]!;
}

// ---------- Refresh tokens ----------

export type RefreshTokenRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  remember: boolean;
};

export async function insertRefreshToken(
  db: DbClient | typeof pool,
  data: { userId: string; tokenHash: string; expiresAt: Date; remember: boolean }
) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, remember)
     VALUES ($1, $2, $3, $4)`,
    [data.userId, data.tokenHash, data.expiresAt, data.remember]
  );
}

/** FOR UPDATE: bloquea la fila para que dos refresh simultáneos no roten el mismo token. */
export async function findRefreshTokenForUpdate(db: DbClient, tokenHash: string) {
  const { rows } = await db.query<RefreshTokenRow>(
    `SELECT id, user_id AS "userId", expires_at AS "expiresAt",
            revoked_at AS "revokedAt", remember
     FROM refresh_tokens
     WHERE token_hash = $1
     FOR UPDATE`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function revokeRefreshToken(db: DbClient | typeof pool, id: string) {
  await db.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL", [id]);
}

export async function revokeRefreshTokenByHash(tokenHash: string) {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    [tokenHash]
  );
}

export async function revokeAllUserTokens(db: DbClient, userId: string) {
  await db.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}
