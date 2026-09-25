import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controller from "./orders.controller.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.post("/", controller.create);
ordersRouter.get("/", controller.list);
ordersRouter.get("/:id", controller.detail);
