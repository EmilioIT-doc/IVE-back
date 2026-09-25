import crypto from "node:crypto";

/**
 * Proveedor de pagos FALSO para desarrollo local (simula a Stripe/Conekta).
 *
 * El front nunca manda el número de tarjeta al back: lo "tokeniza" y manda
 * solo un token. Así los datos de la tarjeta no pasan por tu servidor
 * (en la vida real eso lo hace el SDK del proveedor, y te ahorra cumplir PCI).
 *
 * Tokens de prueba:
 *   tok_success             → pago aprobado
 *   tok_declined            → tarjeta rechazada
 *   tok_insufficient_funds  → fondos insuficientes
 */
export type ChargeResult =
  | { status: "succeeded"; providerPaymentId: string }
  | { status: "failed"; providerPaymentId: string; reason: string };

const FAILURES: Record<string, string> = {
  tok_declined: "La tarjeta fue rechazada",
  tok_insufficient_funds: "Fondos insuficientes",
};

export async function charge(input: { amountCents: number; token: string }): Promise<ChargeResult> {
  await new Promise((r) => setTimeout(r, 150)); // simula la latencia de red
  const providerPaymentId = `mock_${crypto.randomUUID()}`;
  const reason = FAILURES[input.token];
  if (reason) return { status: "failed", providerPaymentId, reason };
  if (input.token !== "tok_success") return { status: "failed", providerPaymentId, reason: "Token de pago inválido" };
  return { status: "succeeded", providerPaymentId };
}
