import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { pool } from "./db.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { categoriesRouter, productsRouter } from "./modules/catalog/catalog.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { addressesRouter } from "./modules/addresses/addresses.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";

export const app = express();

// credentials: true → permite que el navegador mande/reciba cookies desde el front
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  const result = await pool.query("SELECT NOW() AS now");
  res.json({ status: "ok", db: result.rows[0].now });
});

app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/orders", ordersRouter);

// Siempre al final, y en este orden
app.use(notFound);
app.use(errorHandler);
