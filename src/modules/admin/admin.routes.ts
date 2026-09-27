import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middlewares/auth.js";
import * as controller from "./admin.controller.js";
import * as categories from "./categories.controller.js";
import * as site from "../site/site.controller.js";
import * as coupons from "../coupons/coupons.controller.js";
import * as reviews from "../reviews/reviews.controller.js";
import { uploadsRouter } from "../uploads/uploads.routes.js";

export const adminRouter = Router();

// Todo lo de /api/admin: primero sesión válida, luego rol admin
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/products", controller.list);
adminRouter.post("/products", controller.create);
adminRouter.get("/products/:id", controller.detail);
adminRouter.patch("/products/:id", controller.update);
adminRouter.put("/products/:id/variants", controller.syncVariants);
adminRouter.patch("/products/:id/images/order", controller.reorderImages);
adminRouter.delete("/products/:id/images/:imageId", controller.deleteImage);

// Categorías (/order va antes de /:id para que "order" no se lea como id)
adminRouter.get("/categories", categories.list);
adminRouter.post("/categories", categories.create);
adminRouter.patch("/categories/order", categories.reorder);
adminRouter.get("/categories/:id", categories.detail);
adminRouter.patch("/categories/:id", categories.update);
adminRouter.delete("/categories/:id", categories.remove);
adminRouter.delete("/categories/:id/cover", categories.removeCover);
adminRouter.put("/categories/:id/cover-framing", categories.updateCoverFraming);

// Fotos del inicio (la subida va por /site-images/:slot/uploads, abajo)
adminRouter.get("/site-images", site.list);
adminRouter.patch("/site-images/:slot", site.updateAlt);
adminRouter.delete("/site-images/:slot/image", site.removeImage);
adminRouter.put("/site-images/:slot/framing", site.updateFraming);

// Cupones
adminRouter.get("/coupons", coupons.list);
adminRouter.post("/coupons", coupons.create);
adminRouter.patch("/coupons/:id", coupons.update);
adminRouter.delete("/coupons/:id", coupons.remove);

// Reseñas (moderación)
adminRouter.get("/reviews", reviews.adminList);
adminRouter.patch("/reviews/:id", reviews.moderate);

// Subidas de imágenes pesadas por pedazos (ver modules/uploads)
adminRouter.use(uploadsRouter);
