import { pool, withTransaction, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import { FREE_SHIPPING_FROM_CENTS, shippingCostCents } from "../../lib/shipping.js";
import * as repo from "./cart.repository.js";
import type { CartItemRow } from "./cart.repository.js";

function toCart(rows: CartItemRow[]) {
  const items = rows.map((r) => ({
    variantId: r.variantId,
    sku: r.sku,
    size: r.size,
    color: r.color,
    quantity: r.quantity,
    stock: r.stock,
    isAvailable: r.isAvailable,
    unitPriceCents: r.unitPriceCents,
    lineTotalCents: r.unitPriceCents * r.quantity,
    product: { name: r.productName, slug: r.productSlug, imageUrl: r.imageUrl },
  }));
  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalCents,
    shipping: {
      freeFromCents: FREE_SHIPPING_FROM_CENTS,
      remainingForFreeCents: Math.max(0, FREE_SHIPPING_FROM_CENTS - subtotalCents),
      standardCents: shippingCostCents(subtotalCents, "standard"),
    },
  };
}

export type Cart = ReturnType<typeof toCart>;

export async function getCart(userId: string, db: DbClient | typeof pool = pool): Promise<Cart> {
  const cartId = await repo.findCartId(userId, db);
  return toCart(cartId ? await repo.findItems(cartId, db) : []);
}

/** Valida que la variante exista, esté activa y alcance el stock. */
async function assertStock(db: DbClient, variantId: string, quantity: number) {
  const variant = await repo.findVariant(db, variantId);
  if (!variant) throw new AppError(404, "VARIANT_NOT_FOUND", "Ese producto no existe");
  if (!variant.isAvailable) throw new AppError(409, "VARIANT_UNAVAILABLE", "Este producto ya no está disponible");
  if (quantity > variant.stock) {
    throw new AppError(409, "INSUFFICIENT_STOCK", `Solo quedan ${variant.stock} piezas disponibles`, {
      available: variant.stock,
    });
  }
}

export async function addItem(userId: string, variantId: string, quantity: number) {
  return withTransaction(async (client) => {
    const cartId = await repo.getOrCreateCartId(client, userId);
    const current = (await repo.findItemQuantity(client, cartId, variantId)) ?? 0;
    const next = current + quantity;
    await assertStock(client, variantId, next);
    await repo.setItemQuantity(client, cartId, variantId, next);
    return getCart(userId, client);
  });
}

export async function updateItem(userId: string, variantId: string, quantity: number) {
  return withTransaction(async (client) => {
    const cartId = await repo.findCartId(userId, client);
    if (!cartId || (await repo.findItemQuantity(client, cartId, variantId)) === null) {
      throw new AppError(404, "CART_ITEM_NOT_FOUND", "Ese artículo no está en tu bolsa");
    }
    await assertStock(client, variantId, quantity);
    await repo.setItemQuantity(client, cartId, variantId, quantity);
    return getCart(userId, client);
  });
}

export async function removeItem(userId: string, variantId: string) {
  return withTransaction(async (client) => {
    const cartId = await repo.findCartId(userId, client);
    if (!cartId || !(await repo.deleteItem(client, cartId, variantId))) {
      throw new AppError(404, "CART_ITEM_NOT_FOUND", "Ese artículo no está en tu bolsa");
    }
    return getCart(userId, client);
  });
}

/**
 * Al iniciar sesión, el front manda lo que había en la bolsa de invitado.
 * Se suma a la bolsa guardada, recortando al stock disponible y
 * saltando lo que ya no exista, en lugar de fallar por un solo artículo.
 */
export async function mergeGuestCart(userId: string, items: { variantId: string; quantity: number }[]) {
  return withTransaction(async (client) => {
    const cartId = await repo.getOrCreateCartId(client, userId);
    for (const item of items) {
      const variant = await repo.findVariant(client, item.variantId);
      if (!variant || !variant.isAvailable || variant.stock === 0) continue;
      const current = (await repo.findItemQuantity(client, cartId, item.variantId)) ?? 0;
      const next = Math.min(current + item.quantity, variant.stock, 20);
      await repo.setItemQuantity(client, cartId, item.variantId, next);
    }
    return getCart(userId, client);
  });
}
