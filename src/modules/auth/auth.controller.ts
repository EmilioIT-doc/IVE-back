import type { Request, Response } from "express";
import * as service from "./auth.service.js";
import { checkEmailSchema, loginSchema, registerSchema } from "./auth.schemas.js";
import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from "./auth.cookies.js";

// El controlador solo traduce HTTP ↔ servicio: valida la entrada,
// llama al servicio y arma la respuesta. Nada de SQL ni reglas de negocio aquí.

export async function checkEmail(req: Request, res: Response) {
  const { email } = checkEmailSchema.parse(req.body);
  res.json(await service.checkEmail(email));
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const session = await service.register(input);
  setSessionCookies(res, session);
  res.status(201).json({ user: session.user });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const session = await service.login(input);
  setSessionCookies(res, session);
  res.json({ user: session.user });
}

export async function refresh(req: Request, res: Response) {
  try {
    const session = await service.refresh(req.cookies?.[REFRESH_COOKIE]);
    setSessionCookies(res, session);
    res.json({ user: session.user });
  } catch (err) {
    clearSessionCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await service.logout(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await service.me(req.user!.id) });
}
