import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controller from "./coupons.controller.js";

/** /api/coupons — el cliente revisa un código antes de pagar (el descuento real se calcula en el checkout). */
export const couponsRouter = Router();
couponsRouter.post("/preview", requireAuth, controller.preview);
