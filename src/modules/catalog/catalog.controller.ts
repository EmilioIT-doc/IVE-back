import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { shouldCount } from "../../lib/viewDedupe.js";
import * as repo from "./catalog.repository.js";
import * as service from "./catalog.service.js";
import { listProductsQuery, relatedQuery, slugParam } from "./catalog.schemas.js";

export async function categories(_req: Request, res: Response) {
  res.json({ categories: await service.getCategories() });
}

export async function list(req: Request, res: Response) {
  const filters = listProductsQuery.parse(req.query);
  res.json(await service.listProducts(filters));
}

export async function filters(_req: Request, res: Response) {
  res.json(await service.getFilterOptions());
}

export async function detail(req: Request, res: Response) {
  const slug = slugParam.parse(req.params.slug);
  res.json({ product: await service.getProductBySlug(slug) });
}

export async function related(req: Request, res: Response) {
  const slug = slugParam.parse(req.params.slug);
  const { limit } = relatedQuery.parse(req.query);
  res.json({ items: await service.getRelated(slug, limit) });
}

const VISITOR_COOKIE = "ive_vid";
const UUID_RE = /^[0-9a-f-]{36}$/;

/**
 * POST /api/products/:slug/views → cuenta una visita.
 * Cada navegador recibe una cookie anónima (ive_vid) para no contar dos veces
 * a la misma persona en 30 minutos. No guarda nada personal.
 */
export async function registerView(req: Request, res: Response) {
  const slug = slugParam.parse(req.params.slug);
  let visitor: string | undefined = req.cookies?.[VISITOR_COOKIE];
  if (!visitor || !UUID_RE.test(visitor)) {
    visitor = crypto.randomUUID();
    res.cookie(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }
  const counted = shouldCount(visitor, slug);
  const viewCount = counted ? await repo.incrementViews(slug) : await repo.findViewCount(slug);
  if (viewCount === null) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
  res.json({ viewCount, counted });
}
