import { pool, type DbClient } from "../../db.js";

// Lo que SÍ se puede mandar al cliente (nunca el password_hash).
export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "customer" | "admin";
  phone: string | null;
  birthDate: string | null; // "1998-05-21"
};

// Los alias "firstName" convierten snake_case (SQL) a camelCase (JS).
const PUBLIC_USER_COLUMNS = `
  id, email, first_name AS "firstName", last_name AS "lastName", role,
  phone, to_char(birth_date, 'YYYY-MM-DD') AS "birthDate"
`;

export async function emailExists(email: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1) AS exists",
    [email]
  );
  return rows[0]?.exists ?? false;
}

export async function findUserWithHashByEmail(email: string) {
  const { rows } = await pool.query<PublicUser & { passwordHash: string; verifiedAt: Date | null }>(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash AS "passwordHash", verified_at AS "verifiedAt"
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
  data: { email: string; passwordHash: string; firstName: string; lastName: string; phone: string; birthDate: string }
) {
  // verified_at queda NULL: la cuenta no sirve hasta que confirme su código
  const { rows } = await db.query<PublicUser>(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, birth_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [data.email, data.passwordHash, data.firstName, data.lastName, data.phone, data.birthDate]
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

// ---------- Verificación ----------

export type VerifiableUser = PublicUser & { verifiedAt: Date | null };

/** FOR UPDATE opcional: serializa "reenviar código" y "verificar" del mismo usuario. */
export async function findVerifiableByEmail(db: DbClient | typeof pool, email: string, forUpdate = false) {
  const { rows } = await db.query<VerifiableUser>(
    `SELECT ${PUBLIC_USER_COLUMNS}, verified_at AS "verifiedAt" FROM users WHERE email = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [email]
  );
  return rows[0] ?? null;
}

export async function markVerified(db: DbClient, userId: string) {
  await db.query("UPDATE users SET verified_at = NOW() WHERE id = $1 AND verified_at IS NULL", [userId]);
}
