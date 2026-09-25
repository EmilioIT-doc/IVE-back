import { pool, type DbClient } from "../../db.js";
import type { AddressInput } from "./addresses.schemas.js";

type Db = DbClient | typeof pool;

export type Address = {
  id: string;
  recipientName: string;
  phone: string;
  street: string;
  extNumber: string;
  intNumber: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const COLUMNS = `
  id, recipient_name AS "recipientName", phone, street,
  ext_number AS "extNumber", int_number AS "intNumber", neighborhood,
  city, state, postal_code AS "postalCode", country, is_default AS "isDefault"
`;

export async function findAllByUser(userId: string): Promise<Address[]> {
  const { rows } = await pool.query<Address>(
    `SELECT ${COLUMNS} FROM addresses WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

export async function findByIdForUser(db: Db, userId: string, id: string): Promise<Address | null> {
  const { rows } = await db.query<Address>(`SELECT ${COLUMNS} FROM addresses WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] ?? null;
}

export async function countByUser(db: Db, userId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM addresses WHERE user_id = $1", [
    userId,
  ]);
  return rows[0]?.n ?? 0;
}

export async function unsetDefault(db: Db, userId: string) {
  await db.query("UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND is_default", [userId]);
}

export async function setDefault(db: Db, userId: string, id: string) {
  await db.query("UPDATE addresses SET is_default = TRUE WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function insert(db: Db, userId: string, a: AddressInput): Promise<Address> {
  const { rows } = await db.query<Address>(
    `INSERT INTO addresses (user_id, recipient_name, phone, street, ext_number, int_number,
                            neighborhood, city, state, postal_code, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [
      userId, a.recipientName, a.phone, a.street, a.extNumber, a.intNumber,
      a.neighborhood, a.city, a.state, a.postalCode, a.isDefault,
    ]
  );
  return rows[0]!;
}

export async function deleteById(db: Db, userId: string, id: string): Promise<{ wasDefault: boolean } | null> {
  const { rows } = await db.query<{ wasDefault: boolean }>(
    `DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default AS "wasDefault"`,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function findNewestId(db: Db, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    "SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  return rows[0]?.id ?? null;
}
