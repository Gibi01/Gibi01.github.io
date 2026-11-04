import { nombrePresentacion } from '../../shared/nombreCatalogo.js';
import { guardarCatalogo } from '../../shared/guardarCatalogo.js';
import { Request, Response, NextFunction } from 'express';
import { MotivoCancelacion } from './motivoCancelacion.entidad.js';
import { orm } from '../../shared/orm.js';
import { limpiarInput, validarCamposRequeridos, parsearIdNumerico } from '../../shared/validacion.js';

const em = orm.em;

// id no viene del cliente, lo pone la base con autoincrement
const CAMPOS = ['descripcion'];
const CAMPOS_REQUERIDOS = ['descripcion'];

function sanitizeMotivoCancelacionInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = limpiarInput(req.body, CAMPOS);
  if (req.body.sanitizedInput.descripcion !== undefined) req.body.sanitizedInput.descripcion = nombrePresentacion(req.body.sanitizedInput.descripcion);
  next();
}

function validarMotivoCancelacionCreacion(req: Request, res: Response, next: NextFunction) {
  validarCamposRequeridos(req.body.sanitizedInput, CAMPOS_REQUERIDOS);
  next();
}

async function findAll(req: Request, res: Response) {
  const motivos = await em.find(MotivoCancelacion, {});
  res.status(200).json({ message: 'encontrados todos los motivos de cancelación', data: motivos });
}

async function findOne(req: Request, res: Response) {
  const id = parsearIdNumerico(req.params.id);
  const motivo = await em.findOneOrFail(MotivoCancelacion, { id });
  res.status(200).json({ message: 'encontrado motivo de cancelación', data: motivo });
}

async function add(req: Request, res: Response) {
  const motivo = em.create(MotivoCancelacion, req.body.sanitizedInput);
  await guardarCatalogo(em);
  res.status(201).json({ message: 'motivo de cancelación creado', data: motivo });
}

async function update(req: Request, res: Response) {
  const id = parsearIdNumerico(req.params.id);
  const motivo = await em.findOneOrFail(MotivoCancelacion, { id });
  em.assign(motivo, req.body.sanitizedInput);
  await guardarCatalogo(em);
  res.status(200).json({ message: 'motivo de cancelación actualizado', data: motivo });
}

async function remove(req: Request, res: Response) {
  const id = parsearIdNumerico(req.params.id);
  const motivo = await em.findOneOrFail(MotivoCancelacion, { id });
  await em.removeAndFlush(motivo);
  res.status(200).json({ message: 'motivo de cancelación eliminado' });
}

export {
  sanitizeMotivoCancelacionInput,
  validarMotivoCancelacionCreacion,
  findAll,
  findOne,
  add,
  update,
  remove,
};
