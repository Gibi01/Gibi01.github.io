import { Request, Response, NextFunction } from 'express';
import { Agenda } from './agenda.entidad.js';
import { Doctor } from '../doctor/doctor.entidad.js';
import { Turno } from '../turno/turno.entidad.js';
import { orm } from '../../shared/orm.js';
import { limpiarInput, validarCamposRequeridos, parsearIdNumerico } from '../../shared/validacion.js';
import { BadRequestError, ConflictError, ForbiddenError } from '../../shared/errores.js';
import { validarBloques, type BloqueHorario } from './horarios.js';
import { autorizarAgenda, bloquearDoctor, datosBloque, impactoAgenda, recuperarDuraciones, registrarCambio } from './agenda.servicio.js';

const CAMPOS = ['doctorId', 'diaSemana', 'horaInicio', 'horaFin', 'duracionTurnoMinutos', 'terminaDiaSiguiente'];
export function sanitizeAgendaInput(req: Request, _res: Response, next: NextFunction) { req.body.sanitizedInput = limpiarInput(req.body, CAMPOS); next(); }
export function validarAgendaCreacion(req: Request, _res: Response, next: NextFunction) { validarCamposRequeridos(req.body.sanitizedInput, CAMPOS.slice(0, 5)); next(); }
export async function findAll(req: Request, res: Response) {
  res.json({ data: await orm.em.find(Agenda, req.query.doctorId ? { doctor: { matricula: parsearIdNumerico(String(req.query.doctorId)) } } : {}) });
}
export async function findOne(req: Request, res: Response) { res.json({ data: await orm.em.findOneOrFail(Agenda, { id: parsearIdNumerico(req.params.id) }) }); }
export async function estado(req: Request, res: Response) {
  const data = await orm.em.fork().transactional(async tx => {
    const doctor = await bloquearDoctor(tx, parsearIdNumerico(req.params.doctorId));
    autorizarAgenda(doctor, req.usuario!);
    await recuperarDuraciones(tx, doctor);
    await tx.flush();
    const sinDuracion = await tx.find(Turno, { doctor, estado: 'pendiente', duracionTurnoMinutos: null, fechaHoraTurno: { $gte: new Date() } });
    return { version: doctor.versionAgenda, activo: doctor.activo, bloques: await tx.find(Agenda, { doctor }), sinDuracion: sinDuracion.map(t => ({ id: t.id, fechaHoraTurno: t.fechaHoraTurno })) };
  });
  res.json({ data });
}
export async function completarDuracion(req: Request, res: Response) {
  const duracion = req.body.duracionTurnoMinutos;
  if (!Number.isInteger(duracion) || duracion < 1 || duracion > 1440) throw new BadRequestError('Duración inválida');
  await orm.em.fork().transactional(async tx => {
    const doctor = await bloquearDoctor(tx, parsearIdNumerico(req.params.doctorId));
    autorizarAgenda(doctor, req.usuario!);
    const turno = await tx.findOneOrFail(Turno, { id: parsearIdNumerico(req.params.turnoId), doctor });
    if (turno.duracionTurnoMinutos) throw new ConflictError('El turno ya tiene una duración registrada');
    turno.duracionTurnoMinutos = duracion;
  });
  res.json({ message: 'Duración histórica registrada' });
}
async function reemplazar(req: Request, res: Response, previsualizar: boolean) {
  const bloques = req.body.bloques as BloqueHorario[];
  validarBloques(bloques);
  const data = await orm.em.fork().transactional(async tx => {
    const doctor = await bloquearDoctor(tx, parsearIdNumerico(req.params.doctorId));
    autorizarAgenda(doctor, req.usuario!);
    if (!doctor.activo) throw new ConflictError('El profesional está dado de baja');
    if (req.body.version !== doctor.versionAgenda) throw new ConflictError('La agenda cambió. Recargá antes de guardar.');
    await recuperarDuraciones(tx, doctor);
    await tx.flush();
    const impacto = await impactoAgenda(tx, doctor, bloques);
    if (previsualizar) return impacto;
    if (req.body.token !== impacto.token || (impacto.excepciones.length && req.body.aceptarExcepciones !== true)) throw new ConflictError('Revisá nuevamente el impacto y confirmá las reservas que se conservarán.');
    await tx.nativeDelete(Agenda, { doctor });
    for (const bloque of bloques) tx.create(Agenda, { doctor, ...datosBloque(bloque) });
    registrarCambio(tx, doctor, req.usuario!.id, bloques);
    return { version: doctor.versionAgenda };
  });
  res.json({ data });
}
export const previsualizar = (req: Request, res: Response) => reemplazar(req, res, true);
export const guardarSemana = (req: Request, res: Response) => reemplazar(req, res, false);

// Los accesos anteriores también deben respetar las reglas del editor semanal.
async function modificarUno(req: Request, res: Response, accion: 'add' | 'update' | 'remove') {
  const consulta = orm.em.fork();
  const id = accion === 'add' ? undefined : parsearIdNumerico(req.params.id);
  const anterior = id ? await consulta.findOneOrFail(Agenda, { id }) : null;
  const input = req.body?.sanitizedInput ?? {};
  const matricula = anterior?.doctor.matricula ?? parsearIdNumerico(String(input.doctorId));
  if (req.usuario?.rol === 'doctor') {
    const propio = await consulta.findOne(Doctor, { usuario: { id: req.usuario.id } });
    if (propio?.matricula !== matricula) throw new ForbiddenError('Solo podés administrar tu propia agenda');
  }
  const data = await orm.em.fork().transactional(async tx => {
    const doctor = await bloquearDoctor(tx, matricula);
    autorizarAgenda(doctor, req.usuario!);
    if (!doctor.activo) throw new ConflictError('El profesional está dado de baja');
    if (input.doctorId !== undefined && Number(input.doctorId) !== matricula) throw new BadRequestError('Creá un bloque en la agenda del otro profesional; no se transfieren bloques.');
    const actuales = await tx.find(Agenda, { doctor }, { refresh: true });
    const agenda = id ? actuales.find(a => a.id === id) : null;
    if (id && !agenda) throw new ConflictError('La agenda cambió. Recargá la página.');
    const propuesta = { ...(agenda ? datosBloque(agenda) : {}), ...limpiarInput(input, CAMPOS.slice(1)) } as BloqueHorario;
    const bloques = actuales.filter(a => a.id !== id).map(datosBloque);
    if (accion !== 'remove') bloques.push(datosBloque(propuesta));
    validarBloques(bloques);
    await recuperarDuraciones(tx, doctor);
    await tx.flush();
    const impacto = await impactoAgenda(tx, doctor, bloques);
    if (impacto.excepciones.length) throw new ConflictError('Usá el editor semanal para confirmar las reservas fuera de la nueva agenda.');
    let resultado = agenda;
    if (accion === 'add') resultado = tx.create(Agenda, { doctor, ...datosBloque(propuesta) });
    if (accion === 'update' && agenda) tx.assign(agenda, datosBloque(propuesta));
    if (accion === 'remove' && agenda) tx.remove(agenda);
    registrarCambio(tx, doctor, req.usuario!.id, bloques);
    await tx.flush();
    return resultado;
  });
  res.status(accion === 'add' ? 201 : 200).json({ data });
}
export const add = (req: Request, res: Response) => modificarUno(req, res, 'add');
export const update = (req: Request, res: Response) => modificarUno(req, res, 'update');
export const remove = (req: Request, res: Response) => modificarUno(req, res, 'remove');
