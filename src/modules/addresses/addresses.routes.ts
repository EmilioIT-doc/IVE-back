import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controller from "./addresses.controller.js";

export const addressesRouter = Router();

addressesRouter.use(requireAuth);

addressesRouter.get("/", controller.list);
addressesRouter.post("/", controller.create);
addressesRouter.patch("/:id/default", controller.makeDefault);
addressesRouter.delete("/:id", controller.remove);
