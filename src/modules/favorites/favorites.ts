import { Router, type Request, type Response } from "express";
import { pool } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import { idParam } from "../../lib/params.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as catalogRepo from "../catalog/catalog.repository.js";

/**
 * Favoritos (módulo chico: todo en un archivo).
 *   GET    /api/favorites              → { items }   (mismas tarjetas que el catálogo)
 *   PUT    /api/favorites/:productId   → guardar (idempotente: dos veces = una)
 *   DELETE /api/favorites/:productId   → quitar
 */
export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.get("/", async (req: Request, res: Response) => {
  res.json({ items: await catalogRepo.findFavorites(req.user!.id) });
});

favoritesRouter.put("/:productId", async (req: Request, res: Response) => {
  const productId = idParam.parse(req.params.productId);
  // INSERT … SELECT: solo inserta si el producto existe y está visible; ON CONFLICT = ya estaba guardado
  const { rowCount } = await pool.query(
    `INSERT INTO favorites (user_id, product_id)
     SELECT $1, id FROM products WHERE id = $2 AND is_active
     ON CONFLICT DO NOTHING`,
    [req.user!.id, productId]
  );
  if (rowCount === 0) {
    const { rows } = await pool.query("SELECT 1 FROM products WHERE id = $1 AND is_active", [productId]);
    if (rows.length === 0) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
  }
  res.status(204).end();
});

favoritesRouter.delete("/:productId", async (req: Request, res: Response) => {
  const productId = idParam.parse(req.params.productId);
  await pool.query("DELETE FROM favorites WHERE user_id = $1 AND product_id = $2", [req.user!.id, productId]);
  res.status(204).end();
});
