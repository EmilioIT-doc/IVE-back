import { pool, isUniqueViolation, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import { formatMoneyMx } from "../../lib/money.js";
import { getCart } from "../cart/cart.service.js";
import * as repo from "./coupons.repository.js";
import type { CreateCouponInput } from "./coupons.schemas.js";

/** Cuánto descuenta el cupón sobre este subtotal (nunca más que el subtotal). */
export function discountFor(coupon: repo.Coupon, subtotalCents: number) {
  const raw = coupon.discountType === "percent" ? Math.floor((subtotalCents * coupon.discountValue) / 100) : coupon.discountValue;
  return Math.min(raw, subtotalCents);
}

/**
 * Revisa TODAS las reglas del cupón. Se usa igual en la vista previa y en el checkout,
 * así el front nunca decide el descuento: solo lo muestra.
 */
export async function validate(db: DbClient | typeof pool, code: string, userId: string, subtotalCents: number, forUpdate = false) {
  const coupon = await repo.findByCode(db, code, forUpdate);
  const now = Date.now();
  if (!coupon || !coupon.isActive) throw new AppError(404, "COUPON_NOT_FOUND", "Ese cupón no existe o ya no está activo");
  if (coupon.startsAt && coupon.startsAt.getTime() > now) throw new AppError(400, "COUPON_NOT_STARTED", "Ese cupón todavía no está vigente");
  if (coupon.endsAt && coupon.endsAt.getTime() <= now) throw new AppError(400, "COUPON_EXPIRED", "Ese cupón ya venció");
  if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) throw new AppError(409, "COUPON_USED_UP", "Ese cupón ya se agotó");
  if (subtotalCents < coupon.minSubtotalCents) {
    throw new AppError(400, "COUPON_MIN_SUBTOTAL", `Este cupón aplica en compras desde ${formatMoneyMx(coupon.minSubtotalCents)}`, {
      minSubtotalCents: coupon.minSubtotalCents,
    });
  }
  if (coupon.perUserLimit !== null && (await repo.countUserUses(db, coupon.id, userId)) >= coupon.perUserLimit) {
    throw new AppError(409, "COUPON_ALREADY_USED", "Ya usaste este cupón");
  }
  return { coupon, discountCents: discountFor(coupon, subtotalCents) };
}

const describe = (c: repo.Coupon) =>
  c.description ?? (c.discountType === "percent" ? `${c.discountValue}% de descuento` : `${formatMoneyMx(c.discountValue)} de descuento`);

/** Vista previa para el checkout: "VERANO25 → −$150". */
export async function preview(userId: string, code: string) {
  const cart = await getCart(userId);
  if (cart.items.length === 0) throw new AppError(400, "CART_EMPTY", "Tu bolsa está vacía");
  const { coupon, discountCents } = await validate(pool, code, userId, cart.subtotalCents);
  return { code: coupon.code, description: describe(coupon), discountCents };
}

// ------------------------------------------------ admin

export const list = repo.list;

export async function create(input: CreateCouponInput) {
  try {
    return await repo.insert(input);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "COUPON_CODE_TAKEN", "Ya existe un cupón con ese código");
    throw err;
  }
}

export async function setActive(id: string, isActive: boolean) {
  const coupon = await repo.setActive(id, isActive);
  if (!coupon) throw new AppError(404, "COUPON_NOT_FOUND", "Cupón no encontrado");
  return coupon;
}

export async function remove(id: string) {
  if (!(await repo.deleteUnused(id))) {
    throw new AppError(409, "COUPON_IN_USE", "Este cupón ya se usó en pedidos: desactívalo en lugar de borrarlo");
  }
}
