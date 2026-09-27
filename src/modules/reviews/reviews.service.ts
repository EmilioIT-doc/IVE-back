import { AppError } from "../../errors/AppError.js";
import * as repo from "./reviews.repository.js";
import type { ReviewInput } from "./reviews.schemas.js";

async function productIdOrThrow(slug: string) {
  const id = await repo.findProductId(slug);
  if (!id) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
  return id;
}

export async function listForProduct(
  slug: string,
  userId: string | null,
  q: { sort: "recent" | "best" | "worst"; page: number; limit: number }
) {
  const productId = await productIdOrThrow(slug);
  const [summary, items, mine] = await Promise.all([
    repo.summary(productId),
    repo.list(productId, userId, q.sort, q.limit, (q.page - 1) * q.limit),
    userId ? repo.findMine(productId, userId) : Promise.resolve(null),
  ]);
  return { summary, items, mine, page: q.page, totalPages: Math.max(1, Math.ceil(summary.count / q.limit)) };
}

export async function saveMine(slug: string, userId: string, input: ReviewInput) {
  const productId = await productIdOrThrow(slug);
  await repo.upsert(productId, userId, input);
  return repo.findMine(productId, userId);
}

export async function deleteMine(slug: string, userId: string) {
  const productId = await productIdOrThrow(slug);
  if (!(await repo.removeMine(productId, userId))) throw new AppError(404, "REVIEW_NOT_FOUND", "No tienes reseña en este producto");
}

const ADMIN_PAGE = 20;

export async function adminList(status: "all" | "visible" | "hidden", page: number) {
  const rows = await repo.adminList(status, ADMIN_PAGE, (page - 1) * ADMIN_PAGE);
  const total = rows[0]?.total ?? 0;
  return { items: rows.map(({ total: _t, isMine: _m, ...r }) => r), page, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE)), total };
}

export async function moderate(id: string, isHidden: boolean) {
  if (!(await repo.setHidden(id, isHidden))) throw new AppError(404, "REVIEW_NOT_FOUND", "Reseña no encontrada");
}
