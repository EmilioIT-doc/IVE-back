import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

async function migrate() {
  const client = await pool.connect(); //Esto es para que vayan las consultas por medio de una misma conexión o sea se un mismo pool

  try {
    // 1. Tabla de control
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name   TEXT PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Migraciones que ya se corrieron
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.name));

    // 3. Archivos .sql ordenados y los que faltan
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("No hay migraciones pendientes");
      return;
    }

    // 4. Ejecutar cada una en su propia transacción
    for (const file of pending) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`✔ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`✖ Falló ${file}`);
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});