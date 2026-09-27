import type { Request, Response } from "express";
import { idParam } from "../../lib/params.js";
import { slugParam } from "../catalog/catalog.schemas.js";
import * as service from "./reviews.service.js";
import { adminReviewsQuery, listReviewsQuery, moderateSchema, reviewInputSchema } from "./reviews.schemas.js";

export async function list(req: Request, res: Response) {
  const slug = slugParam.parse(req.params.slug);
  res.json(await service.listForProduct(slug, req.user?.id ?? null, listReviewsQuery.parse(req.query)));
}

export async function saveMine(req: Request, res: Response) {
  const slug = slugParam.parse(req.params.slug);
  res.json({ review: await service.saveMine(slug, req.user!.id, reviewInputSchema.parse(req.body)) });
}

export async function deleteMine(req: Request, res: Response) {
  await service.deleteMine(slugParam.parse(req.params.slug), req.user!.id);
  res.status(204).end();
}

export async function adminList(req: Request, res: Response) {
  const { status, page } = adminReviewsQuery.parse(req.query);
  res.json(await service.adminList(status, page));
}

export async function moderate(req: Request, res: Response) {
  const { isHidden } = moderateSchema.parse(req.body);
  await service.moderate(idParam.parse(req.params.id), isHidden);
  res.status(204).end();
}
