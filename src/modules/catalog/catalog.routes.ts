import { Router } from "express";
import * as controller from "./catalog.controller.js";

export const categoriesRouter = Router();
categoriesRouter.get("/", controller.categories);

export const productsRouter = Router();
// /filters va ANTES de /:slug; si no, Express pensaría que "filters" es un slug.
productsRouter.get("/", controller.list);
productsRouter.get("/filters", controller.filters);
productsRouter.get("/:slug", controller.detail);
productsRouter.get("/:slug/related", controller.related);
