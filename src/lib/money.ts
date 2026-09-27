const whole = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** 34900 → "$349" · 34950 → "$349.50" (igual que el front) */
export const formatMoneyMx = (cents: number) => (cents % 100 === 0 ? whole.format(cents / 100) : exact.format(cents / 100));
