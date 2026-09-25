import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/check-email", controller.checkEmail);
authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.get("/me", requireAuth, controller.me);
