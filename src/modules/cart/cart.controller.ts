import type { Request, Response } from "express";
import { idParam } from "../../lib/params.js";
import * as service from "./cart.service.js";
import { addItemSchema, mergeSchema, updateItemSchema } from "./cart.schemas.js";

export async function get(req: Request, res: Response) {
  res.json({ cart: await service.getCart(req.user!.id) });
}

export async function add(req: Request, res: Response) {
  const { variantId, quantity } = addItemSchema.parse(req.body);
  res.status(201).json({ cart: await service.addItem(req.user!.id, variantId, quantity) });
}

export async function update(req: Request, res: Response) {
  const variantId = idParam.parse(req.params.variantId);
  const { quantity } = updateItemSchema.parse(req.body);
  res.json({ cart: await service.updateItem(req.user!.id, variantId, quantity) });
}

export async function remove(req: Request, res: Response) {
  const variantId = idParam.parse(req.params.variantId);
  res.json({ cart: await service.removeItem(req.user!.id, variantId) });
}

export async function merge(req: Request, res: Response) {
  const { items } = mergeSchema.parse(req.body);
  res.json({ cart: await service.mergeGuestCart(req.user!.id, items) });
}
