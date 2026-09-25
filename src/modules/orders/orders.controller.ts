import type { Request, Response } from "express";
import { idParam } from "../../lib/params.js";
import * as service from "./orders.service.js";
import { createOrderSchema, idempotencyKeySchema } from "./orders.schemas.js";

export async function create(req: Request, res: Response) {
  const idempotencyKey = idempotencyKeySchema.parse(req.get("Idempotency-Key"));
  const input = createOrderSchema.parse(req.body);
  const { order, replayed } = await service.createOrder(req.user!.id, input, idempotencyKey);
  res.status(replayed ? 200 : 201).json({ order });
}

export async function list(req: Request, res: Response) {
  res.json({ orders: await service.listOrders(req.user!.id) });
}

export async function detail(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  res.json({ order: await service.getOrder(req.user!.id, id) });
}
