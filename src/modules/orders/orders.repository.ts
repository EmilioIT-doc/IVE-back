import { pool, type DbClient } from "../../db.js";

type Db = DbClient | typeof pool;

export type CheckoutLine = {
  variantId: string;
  quantity: number;
  sku: string;
  size: string;
  color: string;
  stock: number;
  isAvailable: boolean;
  unitPriceCents: number;
  productName: string;
};

export async function findOrderIdByIdempotencyKey(db: Db, key: string) {
  const { rows } = await db.query<{ orderId: string; userId: string }>(
    `SELECT p.order_id AS "orderId", o.user_id AS "userId"
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.idempotency_key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

/** Bloquea el carrito: dos checkouts simultáneos del mismo usuario se forman en fila. */
export async function lockCart(db: DbClient, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>("SELECT id FROM carts WHERE user_id = $1 FOR UPDATE", [userId]);
  return rows[0]?.id ?? null;
}

/**
 * Lee el carrito y BLOQUEA las filas de las variantes (FOR UPDATE OF v).
 * Mientras dure la transacción, nadie más puede cambiar ese stock:
 * así evitamos vender dos veces la última pieza.
 * ORDER BY v.id: bloquear siempre en el mismo orden evita deadlocks.
 */
export async function findCheckoutLinesForUpdate(db: DbClient, cartId: string): Promise<CheckoutLine[]> {
  const { rows } = await db.query<CheckoutLine>(
    `SELECT ci.variant_id AS "variantId", ci.quantity,
            v.sku, v.size, v.color, v.stock,
            (v.is_active AND p.is_active) AS "isAvailable",
            COALESCE(v.price_cents, p.price_cents) AS "unitPriceCents",
            p.name AS "productName"
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE ci.cart_id = $1
     ORDER BY v.id
     FOR UPDATE OF v`,
    [cartId]
  );
  return rows;
}

export async function insertOrder(
  db: DbClient,
  o: {
    userId: string;
    subtotalCents: number;
    discountCents: number;
    couponId: string | null;
    couponCode: string | null;
    shippingCents: number;
    totalCents: number;
    shippingMethod: string;
    shippingAddress: object;
  }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO orders (user_id, subtotal_cents, discount_cents, coupon_id, coupon_code,
                         shipping_cents, total_cents, shipping_method, shipping_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [o.userId, o.subtotalCents, o.discountCents, o.couponId, o.couponCode, o.shippingCents, o.totalCents,
     o.shippingMethod, JSON.stringify(o.shippingAddress)]
  );
  return rows[0]!.id;
}

export async function insertOrderItem(db: DbClient, orderId: string, line: CheckoutLine) {
  await db.query(
    `INSERT INTO order_items (order_id, variant_id, product_name, sku, size, color, unit_price_cents, quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [orderId, line.variantId, line.productName, line.sku, line.size, line.color, line.unitPriceCents, line.quantity]
  );
}

export async function insertPayment(
  db: DbClient,
  p: { orderId: string; providerPaymentId: string; status: string; amountCents: number; idempotencyKey: string }
) {
  await db.query(
    `INSERT INTO payments (order_id, provider, provider_payment_id, status, amount_cents, idempotency_key)
     VALUES ($1, 'mock', $2, $3, $4, $5)`,
    [p.orderId, p.providerPaymentId, p.status, p.amountCents, p.idempotencyKey]
  );
}

export async function decrementStock(db: DbClient, variantId: string, quantity: number) {
  await db.query("UPDATE product_variants SET stock = stock - $2 WHERE id = $1", [variantId, quantity]);
}

export async function setOrderStatus(db: DbClient, orderId: string, status: string) {
  await db.query("UPDATE orders SET status = $2 WHERE id = $1", [orderId, status]);
}

export async function findOrderForUser(db: Db, userId: string, orderId: string) {
  const { rows } = await db.query<{
    id: string;
    status: string;
    subtotalCents: number;
    discountCents: number;
    couponCode: string | null;
    shippingCents: number;
    totalCents: number;
    shippingMethod: string;
    shippingAddress: Record<string, unknown>;
    createdAt: Date;
    paymentStatus: string | null;
  }>(
    `SELECT o.id, o.status, o.subtotal_cents AS "subtotalCents", o.discount_cents AS "discountCents",
            o.coupon_code AS "couponCode", o.shipping_cents AS "shippingCents",
            o.total_cents AS "totalCents", o.shipping_method AS "shippingMethod",
            o.shipping_address AS "shippingAddress", o.created_at AS "createdAt",
            (SELECT p.status FROM payments p WHERE p.order_id = o.id
             ORDER BY p.created_at DESC LIMIT 1) AS "paymentStatus"
     FROM orders o
     WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, userId]
  );
  return rows[0] ?? null;
}

export async function findOrderItems(db: Db, orderId: string) {
  const { rows } = await db.query<{
    variantId: string;
    productName: string;
    sku: string;
    size: string;
    color: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }>(
    `SELECT variant_id AS "variantId", product_name AS "productName", sku, size, color,
            unit_price_cents AS "unitPriceCents", quantity, line_total_cents AS "lineTotalCents"
     FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  return rows;
}

export async function findOrdersByUser(userId: string) {
  const { rows } = await pool.query<{
    id: string;
    status: string;
    totalCents: number;
    createdAt: Date;
    itemCount: number;
  }>(
    `SELECT o.id, o.status, o.total_cents AS "totalCents", o.created_at AS "createdAt",
            COALESCE(SUM(oi.quantity), 0)::int AS "itemCount"
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}
