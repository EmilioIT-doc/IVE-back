import type { Request, Response } from "express";
import * as service from "./catalog.service.js";
import { listProductsQuery, relatedQuery, slugParam } from "./catalog.schemas.js";

export async function categories(_req: Request, res: Response) {
  res.json({ categories: await service.getCategoryTree() });
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
