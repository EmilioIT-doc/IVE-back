import type { Request, Response } from "express";
import { idParam } from "../../lib/params.js";
import * as service from "./admin.service.js";
import { createProductSchema, productUpdateSchema, reorderImagesSchema, variantsSyncSchema } from "./admin.schemas.js";

export async function list(_req: Request, res: Response) {
  res.json({ products: await service.listProducts() });
}

export async function detail(req: Request, res: Response) {
  res.json({ product: await service.getProduct(idParam.parse(req.params.id)) });
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  res.status(201).json({ product: await service.createProduct(input) });
}

export async function update(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  res.json({ product: await service.updateProduct(id, productUpdateSchema.parse(req.body)) });
}

export async function syncVariants(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  const { variants } = variantsSyncSchema.parse(req.body);
  res.json({ product: await service.syncVariants(id, variants) });
}

export async function deleteImage(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  const imageId = idParam.parse(req.params.imageId);
  res.json({ product: await service.removeImage(id, imageId) });
}

export async function reorderImages(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  const { ids } = reorderImagesSchema.parse(req.body);
  res.json({ product: await service.reorderImages(id, ids) });
}
