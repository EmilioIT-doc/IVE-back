import type { Request, Response } from "express";
import { idParam } from "../../lib/params.js";
import * as service from "./addresses.service.js";
import { addressInputSchema } from "./addresses.schemas.js";

export async function list(req: Request, res: Response) {
  res.json({ addresses: await service.list(req.user!.id) });
}

export async function create(req: Request, res: Response) {
  const input = addressInputSchema.parse(req.body);
  res.status(201).json({ address: await service.create(req.user!.id, input) });
}

export async function makeDefault(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  res.json({ address: await service.makeDefault(req.user!.id, id) });
}

export async function remove(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  await service.remove(req.user!.id, id);
  res.status(204).end();
}
