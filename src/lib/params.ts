import { z } from "zod";

/** Ids en la URL: BIGINT de Postgres, los manejamos como string de dígitos. */
export const idParam = z.string().regex(/^\d{1,18}$/, "Id inválido");
