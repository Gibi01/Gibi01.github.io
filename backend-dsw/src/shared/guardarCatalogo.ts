import { type EntityManager, UniqueConstraintViolationException } from '@mikro-orm/core';
import { ConflictError } from './errores.js';

export async function guardarCatalogo(em: EntityManager) {
  try { await em.flush(); }
  catch (error) {
    if (error instanceof UniqueConstraintViolationException) throw new ConflictError('Ya existe un registro con ese nombre. Revisá el listado antes de crear o modificar.');
    throw error;
  }
}
