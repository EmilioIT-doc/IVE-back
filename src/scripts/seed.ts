import argon2 from "argon2";
import { pool } from "../db.js";

// ---------- Tipos ----------
type SeedCategory = { name: string; slug: string; coverUrl?: string };

type SeedColor = { name: string; code: string };

type SeedProduct = {
  category: string; // slug de la categoría
  gender: "unisex" | "hombre" | "mujer";
  name: string;
  slug: string;
  skuBase: string;
  description: string;
  priceCents: number;
  sizes: string[];
  colors: SeedColor[];
  // Fotos servidas desde front/public (ej. "/products/born-to-die-blanco.jpg")
  images?: { url: string; alt: string }[];
};

// ---------- Datos ----------
const BLANCO: SeedColor = { name: "blanco", code: "BLA" };

// Las 4 categorías de IVE (la migración 016 ya las crea; aquí solo nos aseguramos).
// El orden de la lista es el orden en el home.
const CATEGORIES: SeedCategory[] = [
  { name: "T-shirts", slug: "t-shirts", coverUrl: "/products/born-to-die-blanco.jpg" },
  { name: "Crop tops", slug: "crop-tops" },
  { name: "Gym", slug: "gym" },
  { name: "Sudaderas", slug: "sudaderas" },
];

const PRODUCTS: SeedProduct[] = [
  {
    category: "t-shirts",
    gender: "hombre",
    name: "Playera Born to Die",
    slug: "playera-born-to-die",
    skuBase: "PLY-BTD",
    description: "Playera de algodón con estampado gráfico de Born to Die al frente.",
    priceCents: 49900,
    sizes: ["S", "M", "L", "XL"],
    colors: [BLANCO],
    // El orden importa: la 1ª es la portada y la 2ª aparece al pasar el mouse en el catálogo
    images: [
      { url: "/products/born-to-die-blanco.jpg", alt: "Playera Born to Die, vista frontal" },
      { url: "/products/born-to-die-espalda.jpg", alt: "Playera Born to Die, vista de la espalda" },
      { url: "/products/born-to-die-frente-espalda.jpg", alt: "Playera Born to Die, frente y espalda" },
    ],
  },
];

// Usuarios de prueba (contraseñas SOLO para desarrollo local)
const USERS = [
  { email: "admin@ive.store", password: "Admin123!", firstName: "Admin", lastName: "IVE", role: "admin" },
  { email: "demo@ive.store", password: "Demo1234!", firstName: "Demo", lastName: "Cliente", role: "customer" },
];

// ---------- Seed ----------
async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const u of USERS) {
      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, verified_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`, // los de prueba ya vienen verificados
        [u.email, await argon2.hash(u.password), u.firstName, u.lastName, u.role]
      );
    }

    // slug -> id, para encontrar la categoría de cada producto
    const categoryIds = new Map<string, string>();

    // Upsert: si la categoría ya existe (la creó la migración) solo se actualiza
    for (const [position, cat] of CATEGORIES.entries()) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO categories (name, slug, position, cover_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name, position = EXCLUDED.position,
               cover_url = COALESCE(categories.cover_url, EXCLUDED.cover_url)
         RETURNING id`,
        [cat.name, cat.slug, position, cat.coverUrl ?? null]
      );
      categoryIds.set(cat.slug, rows[0].id);
    }

    let variantCount = 0;

    for (const p of PRODUCTS) {
      const categoryId = categoryIds.get(p.category);
      if (!categoryId) {
        throw new Error(`Categoría no encontrada: ${p.category}`);
      }

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO products (category_id, gender, name, slug, description, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [categoryId, p.gender, p.name, p.slug, p.description, p.priceCents]
      );
      const productId = rows[0].id;

      // Fotos del producto (en orden)
      for (const [position, image] of (p.images ?? []).entries()) {
        await client.query(
          `INSERT INTO product_images (product_id, url, alt_text, position)
           VALUES ($1, $2, $3, $4)`,
          [productId, image.url, image.alt, position]
        );
      }

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
      `✔ Seed listo: ${USERS.length} usuarios, ${categoryIds.size} categorías, ${PRODUCTS.length} productos, ${variantCount} variantes`
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
