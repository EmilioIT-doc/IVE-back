/**
 * ¿Ya contamos la visita de este visitante a este producto hace poco?
 * Guardamos en memoria "visitante:producto → última vez" por 30 minutos,
 * así recargar la página 20 veces no infla el contador.
 * (En producción con varios servidores esto iría en Redis; con uno solo, memoria basta.)
 */
const WINDOW_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 50_000;
const seen = new Map<string, number>();

export function shouldCount(visitorId: string, slug: string, now = Date.now()) {
  const key = `${visitorId}:${slug}`;
  const last = seen.get(key);
  if (last !== undefined && now - last < WINDOW_MS) return false;
  seen.set(key, now);
  if (seen.size > MAX_ENTRIES) {
    // Limpieza: borra lo vencido (y si sigue lleno, lo más viejo)
    for (const [k, t] of seen) if (now - t >= WINDOW_MS) seen.delete(k);
    while (seen.size > MAX_ENTRIES) seen.delete(seen.keys().next().value!);
  }
  return true;
}
