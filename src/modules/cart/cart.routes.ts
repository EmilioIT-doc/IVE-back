import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controller from "./cart.controller.js";

export const cartRouter = Router();

cartRouter.use(requireAuth); // todas las rutas del carrito requieren sesión

cartRouter.get("/", controller.get);
cartRouter.post("/items", controller.add);
cartRouter.patch("/items/:variantId", controller.update);
cartRouter.delete("/items/:variantId", controller.remove);
cartRouter.post("/merge", controller.merge);
