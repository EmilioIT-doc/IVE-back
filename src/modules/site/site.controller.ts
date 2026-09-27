import type { Request, Response } from "express";
import { framingSchema } from "../../lib/framing.js";
import * as service from "./site.service.js";

/** Público: GET /api/site-images */
export async function list(_req: Request, res: Response) {
  res.json({ images: await service.all() });
}

export async function updateAlt(req: Request, res: Response) {
  const slot = service.slotParam.parse(req.params.slot);
  const { altText } = service.altSchema.parse(req.body);
  res.json({ images: await service.updateAlt(slot, altText) });
}

export async function updateFraming(req: Request, res: Response) {
  const slot = service.slotParam.parse(req.params.slot);
  res.json({ images: await service.updateFraming(slot, framingSchema.parse(req.body)) });
}

export async function removeImage(req: Request, res: Response) {
  const slot = service.slotParam.parse(req.params.slot);
  res.json({ images: await service.removeImage(slot) });
}
