/** "Playera Born to Die (Edición)" → "playera-born-to-die-edicion" */
export function slugify(text: string): string {
  return text
    .normalize("NFD") // separa letras y acentos: "é" → "e" + "´"
    .replace(/[̀-ͯ]/g, "") // quita los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // todo lo que no sea letra/número → guion
    .replace(/^-+|-+$/g, ""); // sin guiones al inicio ni al final
}

/** "azul marino" → "AZUL-MARINO" (para armar SKUs) */
export const skuPart = (text: string) => slugify(text).toUpperCase();
