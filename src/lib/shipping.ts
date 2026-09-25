// Reglas de envío en un solo lugar (todo en centavos).
export const FREE_SHIPPING_FROM_CENTS = 99_900; // $999
export const STANDARD_SHIPPING_CENTS = 9_900; // $99
export const EXPRESS_SHIPPING_CENTS = 14_900; // $149

export type ShippingMethod = "standard" | "express";

export function shippingCostCents(subtotalCents: number, method: ShippingMethod): number {
  if (method === "express") return EXPRESS_SHIPPING_CENTS;
  return subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : STANDARD_SHIPPING_CENTS;
}
