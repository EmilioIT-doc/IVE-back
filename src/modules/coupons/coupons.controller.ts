import type { Request, Response } from "express";
import { idParam } from "../../lib/params.js";
import * as service from "./coupons.service.js";
import { createCouponSchema, previewCouponSchema, updateCouponSchema } from "./coupons.schemas.js";

export async function preview(req: Request, res: Response) {
  const { code } = previewCouponSchema.parse(req.body);
  res.json({ coupon: await service.preview(req.user!.id, code) });
}

export async function list(_req: Request, res: Response) {
  res.json({ coupons: await service.list() });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ coupon: await service.create(createCouponSchema.parse(req.body)) });
}

export async function update(req: Request, res: Response) {
  const { isActive } = updateCouponSchema.parse(req.body);
  res.json({ coupon: await service.setActive(idParam.parse(req.params.id), isActive) });
}

export async function remove(req: Request, res: Response) {
  await service.remove(idParam.parse(req.params.id));
  res.status(204).end();
}
