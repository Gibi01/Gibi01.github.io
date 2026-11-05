import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../shared/auth.js';
import { Doctor } from './doctor.entidad.js';
import { Agenda } from '../agenda/agenda.entidad.js';
import { Especialidad } from '../especialidad/especialidad.entidad.js';
import { Usuario } from '../usuarios/usuario.entidad.js';
import { orm } from '../../shared/orm.js';
import { limpiarInput, validarCamposRequeridos, parsearIdNumerico } from '../../shared/validacion.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errores.js';

import { LockMode, type EntityManager } from '@mikro-orm/core';
import { Turno } from '../turno/turno.entidad.js';
import { encolarNotificacion } from '../turno/notificacionTurno.servicio.js';
import { bloquearDoctor } from '../agenda/agenda.servicio.js';
const em = orm.em;

async function darDeBaja(tx: EntityManager, doctor: Doctor) {
  doctor.activo = false;
  const turnos = await tx.find(Turno, { doctor, estado: 'pendiente', fechaHoraTurno: { $gte: new Date() } },
    { populate: ['usuario', 'doctor.usuario'], lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true });
  for (const turno of turnos) {
    turno.estado = 'cancelado';
    turno.fechaHoraCancelacion = new Date();
    turno.motivoCancelacion = 'Baja del profesional';
    encolarNotificacion(tx, turno, 'cancelado');
  }
  return turnos.length;
}

// en el alta ademas de la matricula se cargan los datos de la cuenta (Usuario) del doctor
const CAMPOS_ALTA = [
  'matricula',
  'nombre',
  'apellido',
  'email',
  'password',
  'dni',
  'especialidadIds',
];
const CAMPOS_REQUERIDOS_ALTA = ['matricula', 'nombre', 'apellido', 'email', 'password', 'dni'];

// en edicion no se toca la matricula ni la cuenta, eso se edita en /api/usuarios/:id como
// cualquier usuario. la matricula es la PK, no se puede cambiar
const CAMPOS_EDICION = ['especialidadIds', 'activo'];

function sanitizeDoctorAlta(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = limpiarInput(req.body, CAMPOS_ALTA);
  next();
}

function sanitizeDoctorEdicion(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = limpiarInput(req.body, CAMPOS_EDICION);
  next();
}

function validarDoctorCreacion(req: Request, res: Response, next: NextFunction) {
  validarCamposRequeridos(req.body.sanitizedInput, CAMPOS_REQUERIDOS_ALTA);
  next();
}

// respuesta publica del doctor, nunca serializamos el Usuario completo (se filtraria el hash
// de la contraseña), solo lo que hace falta mostrar. las especialidades van como dto plano y
// no la entidad Especialidad cruda, porque esa puede traer su coleccion "doctores" populada
// en otro punto del mismo request y terminamos serializando el Usuario de nuevo en un ciclo
function serializarDoctor(doctor: Doctor) {
  const usuario = doctor.usuario;
  const especialidades = doctor.especialidades.isInitialized() ? doctor.especialidades.getItems() : [];
  return {
    matricula: doctor.matricula,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    foto: usuario.foto ?? null,
    especialidades: especialidades.map((e) => ({
      idEspecialidad: e.idEspecialidad,
      descripcionEsp: e.descripcionEsp,
    })),
    activo: doctor.activo,
  };
}

async function resolverDoctorDelUsuario(usuarioId: number): Promise<Doctor> {
  const doctor = await em.findOne(Doctor, { usuario: usuarioId }, { populate: ['usuario', 'especialidades'] });
  if (!doctor) {
    throw new ForbiddenError('Tu cuenta no tiene un doctor asociado');
  }
  return doctor;
}

async function findAll(req: Request, res: Response) {
  const filtro: Record<string, unknown> = {};
  // el admin ve tambien los dados de baja (para poder reactivarlos), el resto (paciente,
  // doctor o sin sesion) solo ve los activos
  const esCatalogo = req.usuario?.rol !== 'admin' || req.query.conAgenda === 'true';
  if (esCatalogo) {
    filtro.activo = true;
    // Para reservar, el doctor debe tener al menos un bloque semanal creado.
    const agendas = await em.find(Agenda, {}, { fields: ['doctor'] });
    filtro.matricula = { $in: [...new Set(agendas.map((agenda) => agenda.doctor.matricula))] };
  }
  const doctores = await em.find(Doctor, filtro, { populate: ['usuario', 'especialidades'] });
  res.status(200).json({ message: 'encontrados todos los doctores', data: doctores.map(serializarDoctor) });
}

async function findOne(req: Request, res: Response) {
  const matricula = parsearIdNumerico(req.params.matricula);
  const doctor = await em.findOneOrFail(Doctor, { matricula }, { populate: ['usuario', 'especialidades'] });
  if (!doctor.activo && req.usuario?.rol !== 'admin') {
    throw new NotFoundError('Doctor no encontrado');
  }
  res.status(200).json({ message: 'encontrado doctor', data: serializarDoctor(doctor) });
}

// GET /api/doctores/mios, el doctor logueado consulta su propio registro (matricula, etc)
async function misDatos(req: Request, res: Response) {
  const doctor = await resolverDoctorDelUsuario(req.usuario!.id);
  res.status(200).json({ message: 'tu registro de doctor', data: serializarDoctor(doctor) });
}

async function add(req: Request, res: Response) {
  const { matricula, especialidadIds, ...datosUsuario } = req.body.sanitizedInput as {
    matricula: unknown;
    especialidadIds?: number[];
    [key: string]: unknown;
  };

  const email = datosUsuario.email as string;
  const existente = await em.findOne(Usuario, { email });
  if (existente) {
    throw new ConflictError('Ya existe un usuario con ese email');
  }

  const matriculaNum = parsearIdNumerico(String(matricula));
  const matriculaExistente = await em.findOne(Doctor, { matricula: matriculaNum });
  if (matriculaExistente) {
    throw new ConflictError('Ya existe un doctor con esa matrícula');
  }

  if (typeof datosUsuario.password !== 'string' || datosUsuario.password.length < 8) {
    throw new BadRequestError('La contraseña debe tener al menos 8 caracteres');
  }
  if (especialidadIds !== undefined && (!Array.isArray(especialidadIds) || especialidadIds.some((id) => !Number.isInteger(id) || id <= 0))) {
    throw new BadRequestError('Las especialidades deben ser una lista de IDs válidos');
  }
  const especialidades = await em.find(Especialidad, { idEspecialidad: { $in: especialidadIds ?? [] } });
  if (especialidades.length !== new Set(especialidadIds ?? []).size) throw new BadRequestError('Alguna especialidad no existe');
  const cuenta = await auth.api.createUser({
    headers: fromNodeHeaders(req.headers),
    body: { name: datosUsuario.nombre as string, email, password: datosUsuario.password,
      role: 'doctor', data: { apellido: datosUsuario.apellido, dni: datosUsuario.dni } },
  });
  const usuario = await em.findOneOrFail(Usuario, { authUserId: cuenta.user.id });

  const doctor = em.create(Doctor, { matricula: matriculaNum, usuario, activo: true });

  doctor.especialidades.set(especialidades);

  try {
    await em.flush();
  } catch (error) {
    await auth.api.removeUser({ headers: fromNodeHeaders(req.headers), body: { userId: cuenta.user.id } });
    throw error;
  }
  res.status(201).json({ message: 'doctor creado', data: serializarDoctor(doctor) });
}

async function update(req: Request, res: Response) {
  const matricula = parsearIdNumerico(req.params.matricula);
  const data = await orm.em.fork().transactional(async tx => {
    const doctor = await bloquearDoctor(tx, matricula);
    await tx.populate(doctor, ['usuario', 'especialidades']);
    const { especialidadIds, activo } = req.body.sanitizedInput;
    if (activo !== undefined && typeof activo !== 'boolean') throw new BadRequestError('activo debe ser booleano');
    if (especialidadIds !== undefined) {
      if (!Array.isArray(especialidadIds) || especialidadIds.some(id => !Number.isInteger(id))) throw new BadRequestError('Especialidades inválidas');
      const especialidades = await tx.find(Especialidad, { idEspecialidad: { $in: especialidadIds } });
      if (especialidades.length !== new Set(especialidadIds).size) throw new BadRequestError('Alguna especialidad no existe');
      doctor.especialidades.set(especialidades);
    }
    if (activo === false) await darDeBaja(tx, doctor);
    if (activo === true) doctor.activo = true;
    return serializarDoctor(doctor);
  });
  res.json({ message: 'doctor actualizado', data });
}

// DELETE /api/doctores/:matricula, es baja logica nomas, nunca se borra de la base
// (ni el doctor ni sus turnos), solo deja de aparecer como opcion para reservar
async function remove(req: Request, res: Response) {
  const matricula = parsearIdNumerico(req.params.matricula);
  const cancelados = await orm.em.fork().transactional(async tx => darDeBaja(tx, await bloquearDoctor(tx, matricula)));
  res.status(200).json({ message: 'doctor dado de baja; notificaciones encoladas', data: { cancelados } });
}

export {
  sanitizeDoctorAlta,
  sanitizeDoctorEdicion,
  validarDoctorCreacion,
  resolverDoctorDelUsuario,
  findAll,
  findOne,
  misDatos,
  add,
  update,
  remove,
};
