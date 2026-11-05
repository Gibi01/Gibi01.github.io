import { nombrePresentacion } from '../../shared/nombreCatalogo.js';
import { guardarCatalogo } from '../../shared/guardarCatalogo.js';
import { Request, Response, NextFunction } from 'express';
import { ObraSocial } from './obraSocial.entidad.js';
import { orm } from '../../shared/orm.js';
import { limpiarInput, validarCamposRequeridos, parsearIdNumerico } from '../../shared/validacion.js';

const em = orm.em;

// id no viene del cliente, lo pone la base con autoincrement
const CAMPOS = ['nombre'];
const CAMPOS_REQUERIDOS = ['nombre'];

function sanitizeObraSocialInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = limpiarInput(req.body, CAMPOS);
  if (req.body.sanitizedInput.nombre !== undefined) req.body.sanitizedInput.nombre = nombrePresentacion(req.body.sanitizedInput.nombre);
  next();
}

function validarObraSocialCreacion(req: Request, res: Response, next: NextFunction) {
  validarCamposRequeridos(req.body.sanitizedInput, CAMPOS_REQUERIDOS);
  next();
}

async function findAll(req: Request, res: Response) {
  const obrasSociales = await em.find(ObraSocial, {});
  res.status(200).json({ message: 'encontradas todas las obras sociales', data: obrasSociales });
}

async function findOne(req: Request, res: Response) {
  const id = parsearIdNumerico(req.params.id);
  const obraSocial = await em.findOneOrFail(ObraSocial, { id });
  res.status(200).json({ message: 'encontrada obra social', data: obraSocial });
}

async function add(req: Request, res: Response) {
  const obraSocial = em.create(ObraSocial, req.body.sanitizedInput);
  await guardarCatalogo(em);
  res.status(201).json({ message: 'obra social creada', data: obraSocial });
}

async function update(req: Request, res: Response) {
  const id = parsearIdNumerico(req.params.id);
  const obraSocial = await em.findOneOrFail(ObraSocial, { id });
  em.assign(obraSocial, req.body.sanitizedInput);
  await guardarCatalogo(em);
  res.status(200).json({ message: 'obra social actualizada', data: obraSocial });
}

async function remove(req: Request, res: Response) {
  const id = parsearIdNumerico(req.params.id);
  const obraSocial = await em.findOneOrFail(ObraSocial, { id });
  await em.removeAndFlush(obraSocial);
  res.status(200).json({ message: 'obra social eliminada' });
}

export {
  sanitizeObraSocialInput,
  validarObraSocialCreacion,
  findAll,
  findOne,
  add,
  update,
  remove,
};
