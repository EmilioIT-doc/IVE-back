import { AppError } from "../../errors/AppError.js";
import { compareSizes } from "../../lib/sizes.js";
import * as repo from "./catalog.repository.js";
import type { ListProductsFilters } from "./catalog.schemas.js";

/** Categorías visibles para el menú, los filtros y el home. */
export const getCategories = repo.findAllCategories;

export async function listProducts(filters: ListProductsFilters) {
  const { items, total } = await repo.listProducts(filters);
  return {
    items,
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getFilterOptions() {
  const options = await repo.findFilterOptions();
  return { ...options, sizes: options.sizes.sort(compareSizes) };
}

export async function getProductBySlug(slug: string) {
  const product = await repo.findProductBySlug(slug);
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");

  // Dos consultas en paralelo (no una por variante: eso sería el problema N+1)
  const [variants, images] = await Promise.all([
    repo.findVariantsByProductId(product.id),
    repo.findImagesByProductId(product.id),
  ]);

  const colors = [...new Set(variants.map((v) => v.color))];
  const sizes = [...new Set(variants.map((v) => v.size))].sort(compareSizes);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    viewCount: product.viewCount,
    gender: product.gender,
    category: { name: product.categoryName, slug: product.categorySlug },
    images,
    colors,
    sizes,
    variants,
  };
}

export async function getRelated(slug: string, limit: number) {
  const product = await repo.findProductBySlug(slug);
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado");
  return repo.findRelated(product.id, product.categoryId, product.gender, limit);
}
