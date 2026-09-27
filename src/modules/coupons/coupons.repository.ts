import { pool, type DbClient } from "../../db.js";
import type { CreateCouponInput } from "./coupons.schemas.js";

type Db = DbClient | typeof pool;

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usesCount: number;
  perUserLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
};

const COLUMNS = `
  id, code, description, discount_type AS "discountType", discount_value AS "discountValue",
  min_subtotal_cents AS "minSubtotalCents", max_uses AS "maxUses", uses_count AS "usesCount",
  per_user_limit AS "perUserLimit", starts_at AS "startsAt", ends_at AS "endsAt",
  is_active AS "isActive", created_at AS "createdAt"`;

export async function list() {
  const { rows } = await pool.query<Coupon>(`SELECT ${COLUMNS} FROM coupons ORDER BY created_at DESC`);
  return rows;
}

export async function insert(c: CreateCouponInput) {
  const { rows } = await pool.query<Coupon>(
    `INSERT INTO coupons (code, description, discount_type, discount_value, min_subtotal_cents,
                          max_uses, per_user_limit, starts_at, ends_at, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${COLUMNS}`,
    [c.code, c.description ?? null, c.discountType, c.discountValue, c.minSubtotalCents,
     c.maxUses ?? null, c.perUserLimit ?? null, c.startsAt ?? null, c.endsAt ?? null, c.isActive]
  );
  return rows[0]!;
}

export async function setActive(id: string, isActive: boolean) {
  const { rows } = await pool.query<Coupon>(
    `UPDATE coupons SET is_active = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, isActive]
  );
  return rows[0] ?? null;
}

/** Solo se borran los que nunca se usaron (los usados quedan ligados a pedidos: se desactivan). */
export async function deleteUnused(id: string) {
  const { rowCount } = await pool.query("DELETE FROM coupons WHERE id = $1 AND uses_count = 0", [id]);
  return rowCount === 1;
}

/**
 * Busca el cupón por código. En el checkout va con FOR UPDATE: si dos personas usan
 * el último cupón disponible al mismo tiempo, la segunda espera y ya lo ve agotado.
 */
export async function findByCode(db: Db, code: string, forUpdate = false) {
  const { rows } = await db.query<Coupon>(
    `SELECT ${COLUMNS} FROM coupons WHERE code = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [code]
  );
  return rows[0] ?? null;
}

/** Cuántas veces lo ha usado esta persona (pedidos no cancelados). */
export async function countUserUses(db: Db, couponId: string, userId: string) {
  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM orders WHERE coupon_id = $1 AND user_id = $2 AND status <> 'cancelled'`,
    [couponId, userId]
  );
  return rows[0]!.n;
}

export async function incrementUses(db: Db, couponId: string) {
  await db.query("UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1", [couponId]);
}
