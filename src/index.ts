import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db.js";
import { startImageQueue, stopImageQueue } from "./modules/uploads/imageQueue.js";

const server = app.listen(env.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${env.PORT}`);
  startImageQueue();
});

// Apagado ordenado (Ctrl+C o reinicio de tsx watch): deja de aceptar peticiones,
// espera a que los workers suelten su imagen y cierra la conexión a la base.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} recibido, apagando…`);
  // Si algo se atora, salimos igual a los 10 s (lo que quede a medias lo retoma la cola al volver)
  setTimeout(() => process.exit(0), 10_000).unref();
  server.close();
  await stopImageQueue();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
