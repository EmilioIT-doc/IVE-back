import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Datos inválidos (Zod)
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Datos inválidos",
        details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
    return;
  }

  // Errores esperados
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Body más grande que el límite (express.json / express.raw)
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "La petición es demasiado grande" } });
    return;
  }

  // JSON mal formado en el body
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "El cuerpo de la petición no es JSON válido" } });
    return;
  }

  // Cualquier otra cosa es un bug: se registra, pero NO se muestra al cliente
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
};
