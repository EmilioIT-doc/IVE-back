import pg from "pg";
import { env } from "./config/env.js";

const { Pool } = pg;

export type DbClient = pg.PoolClient;

export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
});

/**
 * Ejecuta `fn` dentro de una transacción.
 * - Si `fn` termina bien → COMMIT.
 * - Si lanza un error → ROLLBACK y el error sigue su camino.
 * Todas las consultas de `fn` deben usar el `client` que recibe,
 * porque una transacción vive en UNA sola conexión.
 */
export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Código de Postgres para "violación de UNIQUE". */
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === PG_UNIQUE_VIOLATION;
}
