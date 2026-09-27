import type { Request, Response } from "express";
import { framingSchema } from "../../lib/framing.js";
import { idParam } from "../../lib/params.js";
import * as service from "./categories.service.js";
import { createCategorySchema, reorderCategoriesSchema, updateCategorySchema } from "./categories.schemas.js";

export async function list(_req: Request, res: Response) {
  res.json({ categories: await service.list() });
}

export async function detail(req: Request, res: Response) {
  res.json({ category: await service.get(idParam.parse(req.params.id)) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ category: await service.create(createCategorySchema.parse(req.body)) });
}

export async function update(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  res.json({ category: await service.update(id, updateCategorySchema.parse(req.body)) });
}

export async function reorder(req: Request, res: Response) {
  const { ids } = reorderCategoriesSchema.parse(req.body);
  res.json({ categories: await service.reorder(ids) });
}

export async function remove(req: Request, res: Response) {
  await service.remove(idParam.parse(req.params.id));
  res.status(204).end();
}

export async function updateCoverFraming(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  res.json({ category: await service.updateCoverFraming(id, framingSchema.parse(req.body)) });
}

export async function removeCover(req: Request, res: Response) {
  res.json({ category: await service.removeCover(idParam.parse(req.params.id)) });
}
