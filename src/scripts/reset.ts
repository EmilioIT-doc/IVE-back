import { pool } from "../db.js";

if (process.env.NODE_ENV === "production") {
  console.error("db:reset está prohibido en producción");
  process.exit(1);
}

await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("Base de datos vaciada");

await pool.end();