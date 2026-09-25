/**
 * Error "esperado": algo que el cliente hizo mal o que la regla de negocio no permite.
 * El errorHandler lo convierte en una respuesta JSON con su código HTTP.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
