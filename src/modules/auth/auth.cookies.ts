import type { CookieOptions, Response } from "express";
import { env } from "../../config/env.js";
import type { Session } from "./auth.service.js";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const base: CookieOptions = {
  httpOnly: true, // JavaScript del navegador NO puede leerla (protege contra XSS)
  secure: env.NODE_ENV === "production", // en producción solo viaja por HTTPS
  sameSite: "lax", // no se manda en peticiones POST desde otros sitios (protege contra CSRF)
};

// El refresh token solo se envía a las rutas de auth, no en cada petición.
const refreshCookie: CookieOptions = { ...base, path: "/api/auth" };

export function setSessionCookies(res: Response, session: Session) {
  res.cookie(ACCESS_COOKIE, session.accessToken, { ...base, path: "/" });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...refreshCookie,
    // Con "recordarme" la cookie sobrevive al cerrar el navegador;
    // sin él, es una cookie de sesión y se borra al cerrarlo.
    ...(session.remember ? { expires: session.refreshExpiresAt } : {}),
  });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
  res.clearCookie(REFRESH_COOKIE, refreshCookie);
}
