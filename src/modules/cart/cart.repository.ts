import { pool, type DbClient } from "../../db.js";

type Db = DbClient | typeof pool;

export type CartItemRow = {
  variantId: string;
  quantity: number;
  sku: string;
  size: string;
  color: string;
  stock: number;
  isAvailable: boolean;
  unitPriceCents: number;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
};

export async function findCartId(userId: string, db: Db = pool): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>("SELECT id FROM carts WHERE user_id = $1", [userId]);
  return rows[0]?.id ?? null;
}

/** "Upsert": crea el carrito si no existe; si ya existe, regresa el mismo. */
export async function getOrCreateCartId(db: Db, userId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [userId]
  );
  return rows[0]!.id;
}

export async function findItems(cartId: string, db: Db = pool): Promise<CartItemRow[]> {
  const { rows } = await db.query<CartItemRow>(
    `SELECT ci.variant_id AS "variantId", ci.quantity,
            v.sku, v.size, v.color, v.stock,
            (v.is_active AND p.is_active) AS "isAvailable",
            COALESCE(v.price_cents, p.price_cents) AS "unitPriceCents",
            p.name AS "productName", p.slug AS "productSlug",
            (SELECT i.url FROM product_images i
             WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS "imageUrl"
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.added_at, ci.variant_id`,
    [cartId]
  );
  return rows;
}

export async function findVariant(db: Db, variantId: string) {
  const { rows } = await db.query<{ id: string; stock: number; isAvailable: boolean }>(
    `SELECT v.id, v.stock, (v.is_active AND p.is_active) AS "isAvailable"
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.id = $1`,
    [variantId]
  );
  return rows[0] ?? null;
}

export async function findItemQuantity(db: Db, cartId: string, variantId: string): Promise<number | null> {
  const { rows } = await db.query<{ quantity: number }>(
    "SELECT quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2",
    [cartId, variantId]
  );
  return rows[0]?.quantity ?? null;
}

/** Deja la cantidad EXACTA indicada (inserta o actualiza con ON CONFLICT). */
export async function setItemQuantity(db: Db, cartId: string, variantId: string, quantity: number) {
  await db.query(
    `INSERT INTO cart_items (cart_id, variant_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
    [cartId, variantId, quantity]
  );
}

export async function deleteItem(db: Db, cartId: string, variantId: string): Promise<boolean> {
  const { rowCount } = await db.query("DELETE FROM cart_items WHERE cart_id = $1 AND variant_id = $2", [
    cartId,
    variantId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function clearItems(db: Db, cartId: string) {
  await db.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
}
