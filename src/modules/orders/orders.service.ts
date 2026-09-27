import { isUniqueViolation, pool, withTransaction, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import { charge } from "../../lib/payments/mockProvider.js";
import { shippingCostCents } from "../../lib/shipping.js";
import * as addressesRepo from "../addresses/addresses.repository.js";
import * as addressesService from "../addresses/addresses.service.js";
import * as cartRepo from "../cart/cart.repository.js";
import * as couponsRepo from "../coupons/coupons.repository.js";
import * as couponsService from "../coupons/coupons.service.js";
import * as repo from "./orders.repository.js";
import type { CreateOrderInput } from "./orders.schemas.js";

async function getOrderDetail(db: DbClient | typeof pool, userId: string, orderId: string) {
  const order = await repo.findOrderForUser(db, userId, orderId);
  // 404 y no 403: no le confirmamos a nadie que existe una orden ajena
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido no encontrado");
  const items = await repo.findOrderItems(db, orderId);
  return { ...order, items };
}

export const getOrder = (userId: string, orderId: string) => getOrderDetail(pool, userId, orderId);
export const listOrders = repo.findOrdersByUser;

/**
 * Checkout completo en UNA transacción:
 *  1. Bloquea el carrito y revisa idempotencia: si ya se procesó esta llave,
 *     regresa la misma orden (no se cobra dos veces).
 *  2. Bloquea las variantes y valida stock.
 *  3. Resuelve la dirección y guarda una COPIA en la orden.
 *  4. Calcula totales (siempre en el servidor, nunca confiar en el front).
 *  5. Crea la orden y sus renglones.
 *  6. Cobra con el proveedor (mock). Si falla → ROLLBACK de todo.
 *  7. Registra el pago, descuenta stock, marca como pagada y vacía la bolsa.
 *
 * Nota de mundo real: con un proveedor real no se cobra dentro de una transacción
 * con filas bloqueadas (una llamada lenta de red retiene los bloqueos). Se crea la
 * orden "pending", se cobra fuera, y un webhook confirma el pago. Para aprender, así basta.
 */
export async function createOrder(userId: string, input: CreateOrderInput, idempotencyKey: string) {
  try {
    return await withTransaction(async (client) => {
      // Primero bloqueamos el carrito: si llegan dos peticiones iguales (doble clic),
      // la segunda espera aquí a que la primera termine, y luego ve su resultado.
      const cartId = await repo.lockCart(client, userId);

      // 1. Idempotencia
      const previous = await repo.findOrderIdByIdempotencyKey(client, idempotencyKey);
      if (previous) {
        if (previous.userId !== userId) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Esta llave ya se usó");
        }
        return { order: await getOrderDetail(client, userId, previous.orderId), replayed: true };
      }

      // 2. Carrito + stock
      const lines = cartId ? await repo.findCheckoutLinesForUpdate(client, cartId) : [];
      if (lines.length === 0) throw new AppError(400, "CART_EMPTY", "Tu bolsa está vacía");

      const problems = lines
        .filter((l) => !l.isAvailable || l.stock < l.quantity)
        .map((l) => ({
          variantId: l.variantId,
          sku: l.sku,
          requested: l.quantity,
          available: l.isAvailable ? l.stock : 0,
        }));
      if (problems.length > 0) {
        throw new AppError(409, "INSUFFICIENT_STOCK", "Algunos artículos ya no tienen suficiente stock", problems);
      }

      // 3. Dirección (copia/snapshot)
      let address;
      if (input.addressId) {
        address = await addressesRepo.findByIdForUser(client, userId, input.addressId);
        if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Dirección no encontrada");
      } else if (input.saveAddress) {
        address = await addressesService.create(userId, input.address!, client);
      } else {
        address = input.address!;
      }
      const shippingAddress = {
        recipientName: address.recipientName,
        phone: address.phone,
        street: address.street,
        extNumber: address.extNumber,
        intNumber: address.intNumber,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: "country" in address ? address.country : "MX",
      };

      // 4. Totales (+ cupón, validado de nuevo y con la fila BLOQUEADA para no pasarse de usos)
      const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
      const applied = input.couponCode
        ? await couponsService.validate(client, input.couponCode, userId, subtotalCents, true)
        : null;
      const discountCents = applied?.discountCents ?? 0;
      // El envío gratis se calcula sobre lo que de verdad paga (ya con descuento)
      const shippingCents = shippingCostCents(subtotalCents - discountCents, input.shippingMethod);
      const totalCents = subtotalCents - discountCents + shippingCents;

      // 5. Orden + renglones
      const orderId = await repo.insertOrder(client, {
        userId,
        subtotalCents,
        discountCents,
        couponId: applied?.coupon.id ?? null,
        couponCode: applied?.coupon.code ?? null,
        shippingCents,
        totalCents,
        shippingMethod: input.shippingMethod,
        shippingAddress,
      });
      for (const line of lines) await repo.insertOrderItem(client, orderId, line);

      // 6. Cobro
      const payment = await charge({ amountCents: totalCents, token: input.paymentToken });
      if (payment.status === "failed") {
        throw new AppError(402, "PAYMENT_DECLINED", payment.reason);
      }

      // 7. Confirmación
      await repo.insertPayment(client, {
        orderId,
        providerPaymentId: payment.providerPaymentId,
        status: "succeeded",
        amountCents: totalCents,
        idempotencyKey,
      });
      for (const line of lines) await repo.decrementStock(client, line.variantId, line.quantity);
      await repo.setOrderStatus(client, orderId, "paid");
      if (applied) await couponsRepo.incrementUses(client, applied.coupon.id);
      await cartRepo.clearItems(client, cartId!);

      return { order: await getOrderDetail(client, userId, orderId), replayed: false };
    });
  } catch (err) {
    // Dos peticiones con la misma llave al mismo tiempo: la segunda choca con el UNIQUE
    if (isUniqueViolation(err)) {
      throw new AppError(409, "DUPLICATE_REQUEST", "Este pago ya se está procesando");
    }
    throw err;
  }
}
