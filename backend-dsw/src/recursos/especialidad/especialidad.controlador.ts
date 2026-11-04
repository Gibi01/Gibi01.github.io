import { nombrePresentacion } from '../../shared/nombreCatalogo.js';
import { guardarCatalogo } from '../../shared/guardarCatalogo.js';
import { Request, Response, NextFunction } from 'express';
import { Especialidad } from './especialidad.entidad.js';
import { orm } from '../../shared/orm.js';
import { validarIconoEspecialidad } from './iconos.js';
import { limpiarInput, validarCamposRequeridos, parsearIdNumerico } from '../../shared/validacion.js';

const em = orm.em;

// idEspecialidad no viene del cliente, lo pone la base con autoincrement
const CAMPOS = ['descripcionEsp', 'icono'];
const CAMPOS_REQUERIDOS = ['descripcionEsp'];

function sanitizeEspecialidadInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = limpiarInput(req.body, CAMPOS);
  if (req.body.sanitizedInput.descripcionEsp !== undefined) req.body.sanitizedInput.descripcionEsp = nombrePresentacion(req.body.sanitizedInput.descripcionEsp);
  validarIconoEspecialidad(req.body.sanitizedInput.icono);
  next();
}

function validarEspecialidadCreacion(req: Request, res: Response, next: NextFunction) {
  validarCamposRequeridos(req.body.sanitizedInput, CAMPOS_REQUERIDOS);
  next();
}

async function findAll(req: Request, res: Response) {
  const especialidades = await em.find(Especialidad,
    req.query.conMedicosActivos === 'true' ? { doctores: { activo: true } } : {});
  res.status(200).json({ message: 'encontradas todas las especialidades', data: especialidades });
}

async function findOne(req: Request, res: Response) {
  const idEspecialidad = parsearIdNumerico(req.params.id);
  const especialidad = await em.findOneOrFail(
    Especialidad,
    { idEspecialidad },
    { populate: ['doctores', 'doctores.usuario'] }
  );
  const data = {
    idEspecialidad: especialidad.idEspecialidad,
    descripcionEsp: especialidad.descripcionEsp,
    icono: especialidad.icono,
    // un doctor dado de baja no se muestra nunca. y nunca mandamos el Usuario completo
    // (tiene la contraseña), solo los datos publicos
    doctores: especialidad.doctores
      .getItems()
      .filter((d) => d.activo)
      .map((d) => ({ matricula: d.matricula, nombre: d.usuario.nombre, apellido: d.usuario.apellido })),
  };
  res.status(200).json({ message: 'encontrada especialidad', data });
}

async function add(req: Request, res: Response) {
  const especialidad = em.create(Especialidad, req.body.sanitizedInput);
  await guardarCatalogo(em);
  res.status(201).json({ message: 'especialidad creada', data: especialidad });
}

async function update(req: Request, res: Response) {
  const idEspecialidad = parsearIdNumerico(req.params.id);
  const especialidad = await em.findOneOrFail(Especialidad, { idEspecialidad });
  em.assign(especialidad, req.body.sanitizedInput);
  await guardarCatalogo(em);
  res.status(200).json({ message: 'especialidad actualizada', data: especialidad });
}

async function remove(req: Request, res: Response) {
  const idEspecialidad = parsearIdNumerico(req.params.id);
  const especialidad = await em.findOneOrFail(Especialidad, { idEspecialidad });
  await em.removeAndFlush(especialidad);
  res.status(200).json({ message: 'especialidad eliminada' });
}

export {
  sanitizeEspecialidadInput,
  validarEspecialidadCreacion,
  findAll,
  findOne,
  add,
  update,
  remove,
};
