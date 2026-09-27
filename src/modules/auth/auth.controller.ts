import type { Request, Response } from "express";
import * as service from "./auth.service.js";
import { checkEmailSchema, loginSchema, registerSchema, resendSchema, verifySchema } from "./auth.schemas.js";
import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from "./auth.cookies.js";

// El controlador solo traduce HTTP ↔ servicio: valida la entrada,
// llama al servicio y arma la respuesta. Nada de SQL ni reglas de negocio aquí.

export async function checkEmail(req: Request, res: Response) {
  const { email } = checkEmailSchema.parse(req.body);
  res.json(await service.checkEmail(email));
}

/** 201 → { verification }: la cuenta se creó, falta confirmar el código (todavía no hay sesión). */
export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  res.status(201).json({ verification: await service.register(input) });
}

export async function resendCode(req: Request, res: Response) {
  const { email, channel } = resendSchema.parse(req.body);
  res.json({ verification: await service.resendCode(email, channel) });
}

/** Código correcto → cuenta confirmada + sesión iniciada. */
export async function verify(req: Request, res: Response) {
  const { email, code } = verifySchema.parse(req.body);
  const session = await service.verify(email, code);
  setSessionCookies(res, session);
  res.json({ user: session.user });
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
