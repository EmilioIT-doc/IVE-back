import { withTransaction, type DbClient } from "../../db.js";
import { AppError } from "../../errors/AppError.js";
import * as repo from "./addresses.repository.js";
import type { AddressInput } from "./addresses.schemas.js";

export const list = repo.findAllByUser;

/**
 * Crea una dirección. Si es la primera o viene marcada como predeterminada,
 * primero se quita la marca a las demás (el índice único parcial de la tabla
 * no permite dos predeterminadas por usuario).
 * Recibe un `client` opcional para poder usarse dentro del checkout.
 */
export async function create(userId: string, input: AddressInput, client?: DbClient) {
  const run = async (db: DbClient) => {
    const isFirst = (await repo.countByUser(db, userId)) === 0;
    const isDefault = input.isDefault || isFirst;
    if (isDefault) await repo.unsetDefault(db, userId);
    return repo.insert(db, userId, { ...input, isDefault });
  };
  return client ? run(client) : withTransaction(run);
}

export async function makeDefault(userId: string, id: string) {
  return withTransaction(async (db) => {
    const address = await repo.findByIdForUser(db, userId, id);
    if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Dirección no encontrada");
    await repo.unsetDefault(db, userId);
    await repo.setDefault(db, userId, id);
    return { ...address, isDefault: true };
  });
}

export async function remove(userId: string, id: string) {
  await withTransaction(async (db) => {
    const deleted = await repo.deleteById(db, userId, id);
    if (!deleted) throw new AppError(404, "ADDRESS_NOT_FOUND", "Dirección no encontrada");
    // Si borró la predeterminada, la más reciente toma su lugar
    if (deleted.wasDefault) {
      const newest = await repo.findNewestId(db, userId);
      if (newest) await repo.setDefault(db, userId, newest);
    }
  });
}
