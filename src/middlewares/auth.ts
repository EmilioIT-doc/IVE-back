import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/AppError.js";
import { ACCESS_COOKIE } from "../modules/auth/auth.cookies.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";

/** Exige un access token válido y deja al usuario en req.user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: string | undefined = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(new AppError(401, "UNAUTHORIZED", "Inicia sesión para continuar"));

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    // TOKEN_EXPIRED le avisa al front que puede intentar /auth/refresh.
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, "TOKEN_EXPIRED", "Tu sesión expiró"));
    }
    next(new AppError(401, "UNAUTHORIZED", "Sesión inválida"));
  }
};

/** Solo para administradores (úsalo después de requireAuth). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "admin") return next(new AppError(403, "FORBIDDEN", "No tienes permiso"));
  next();
};
