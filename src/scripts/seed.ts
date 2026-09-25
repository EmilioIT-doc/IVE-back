import { pool } from "../db.js";

// ---------- Tipos ----------
type SeedCategory = {
  name: string;
  slug: string;
  children?: SeedCategory[];
};

type SeedColor = { name: string; code: string };

type SeedProduct = {
  category: string; // slug de la categoría
  name: string;
  slug: string;
  skuBase: string;
  description: string;
  priceCents: number;
  sizes: string[];
  colors: SeedColor[];
};

// ---------- Datos ----------
const NEGRO: SeedColor = { name: "negro", code: "NEG" };
const BLANCO: SeedColor = { name: "blanco", code: "BLA" };
const GRIS: SeedColor = { name: "gris", code: "GRI" };
const BEIGE: SeedColor = { name: "beige", code: "BEI" };
const OLIVO: SeedColor = { name: "verde olivo", code: "VOL" };
const MARINO: SeedColor = { name: "azul marino", code: "AZM" };
const AZUL: SeedColor = { name: "azul", code: "AZU" };

const CATEGORIES: SeedCategory[] = [
  {
    name: "Hombre",
    slug: "hombre",
    children: [
      { name: "Playeras", slug: "hombre-playeras" },
      { name: "Sudaderas", slug: "hombre-sudaderas" },
      { name: "Pantalones", slug: "hombre-pantalones" },
    ],
  },
  {
    name: "Mujer",
    slug: "mujer",
    children: [
      { name: "Blusas", slug: "mujer-blusas" },
      { name: "Vestidos", slug: "mujer-vestidos" },
      { name: "Pantalones", slug: "mujer-pantalones" },
    ],
  },
];

const PRODUCTS: SeedProduct[] = [
  {
    category: "hombre-playeras",
    name: "Playera básica",
    slug: "playera-basica",
    skuBase: "PLY-BAS",
    description: "Playera de algodón 100% con corte regular.",
    priceCents: 34900,
    sizes: ["S", "M", "L", "XL"],
    colors: [NEGRO, BLANCO, GRIS],
  },
  {
    category: "hombre-playeras",
    name: "Playera oversize",
    slug: "playera-oversize",
    skuBase: "PLY-OVS",
    description: "Playera de corte holgado y hombro caído.",
    priceCents: 44900,
    sizes: ["S", "M", "L"],
    colors: [NEGRO, BEIGE],
  },
  {
    category: "hombre-sudaderas",
    name: "Sudadera con capucha",
    slug: "sudadera-con-capucha",
    skuBase: "SUD-CAP",
    description: "Sudadera de felpa con capucha y bolsa canguro.",
    priceCents: 89900,
    sizes: ["S", "M", "L", "XL"],
    colors: [NEGRO, GRIS],
  },
  {
    category: "hombre-pantalones",
    name: "Pantalón cargo",
    slug: "pantalon-cargo",
    skuBase: "PAN-CRG",
    description: "Pantalón cargo de gabardina con bolsas laterales.",
    priceCents: 79900,
    sizes: ["28", "30", "32", "34"],
    colors: [OLIVO, NEGRO],
  },
  {
    category: "mujer-blusas",
    name: "Blusa de lino",
    slug: "blusa-de-lino",
    skuBase: "BLU-LIN",
    description: "Blusa fresca de lino con botones al frente.",
    priceCents: 59900,
    sizes: ["XS", "S", "M", "L"],
    colors: [BLANCO, BEIGE],
  },
  {
    category: "mujer-vestidos",
    name: "Vestido midi",
    slug: "vestido-midi",
    skuBase: "VES-MID",
    description: "Vestido midi de caída ligera con cintura ajustable.",
    priceCents: 99900,
    sizes: ["XS", "S", "M", "L"],
    colors: [NEGRO, MARINO],
  },
  {
    category: "mujer-pantalones",
    name: "Jeans mom fit",
    slug: "jeans-mom-fit",
    skuBase: "JEA-MOM",
    description: "Jeans de tiro alto con corte mom fit.",
    priceCents: 84900,
    sizes: ["24", "26", "28", "30"],
    colors: [AZUL, NEGRO],
  },
];

// ---------- Seed ----------
async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // slug -> id, para encontrar la categoría de cada producto
    const categoryIds = new Map<string, string>();

    // Función recursiva: inserta una categoría y luego sus hijas
    async function insertCategory(cat: SeedCategory, parentId: string | null) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO categories (name, slug, parent_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [cat.name, cat.slug, parentId]
      );
      const id = rows[0].id;
      categoryIds.set(cat.slug, id);

      for (const child of cat.children ?? []) {
        await insertCategory(child, id);
      }
    }

    for (const cat of CATEGORIES) {
      await insertCategory(cat, null);
    }

    let variantCount = 0;

    for (const p of PRODUCTS) {
      const categoryId = categoryIds.get(p.category);
      if (!categoryId) {
        throw new Error(`Categoría no encontrada: ${p.category}`);
      }

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO products (category_id, name, slug, description, price_cents)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [categoryId, p.name, p.slug, p.description, p.priceCents]
      );
      const productId = rows[0].id;

      // Una variante por cada combinación color × talla
      for (const color of p.colors) {
        for (const size of p.sizes) {
          const sku = `${p.skuBase}-${color.code}-${size}`;
          const stock = Math.floor(Math.random() * 21); // 0 a 20

          await client.query(
            `INSERT INTO product_variants (product_id, sku, size, color, stock)
             VALUES ($1, $2, $3, $4, $5)`,
            [productId, sku, size, color.name, stock]
          );
          variantCount++;
        }
      }
    }

    await client.query("COMMIT");
    console.log(
      `✔ Seed listo: ${categoryIds.size} categorías, ${PRODUCTS.length} productos, ${variantCount} variantes`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
