import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middlewares/auth.js";
import * as controller from "./reviews.controller.js";

/** Se monta en /api/products: /api/products/:slug/reviews… */
export const reviewsRouter = Router();
reviewsRouter.get("/:slug/reviews", optionalAuth, controller.list);
reviewsRouter.put("/:slug/reviews/mine", requireAuth, controller.saveMine);
reviewsRouter.delete("/:slug/reviews/mine", requireAuth, controller.deleteMine);
