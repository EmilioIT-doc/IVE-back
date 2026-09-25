// Orden natural de tallas: letras primero (XS → XXL), luego números (24, 26, 28…).
const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function compareSizes(a: string, b: string): number {
  const ia = LETTER_SIZES.indexOf(a);
  const ib = LETTER_SIZES.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return Number(a) - Number(b) || a.localeCompare(b);
}
