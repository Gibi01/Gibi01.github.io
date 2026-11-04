import { LockMode, type EntityManager } from '@mikro-orm/core';
import { createHash } from 'node:crypto';
import { Doctor } from '../doctor/doctor.entidad.js';
import { Turno } from '../turno/turno.entidad.js';
import { Agenda } from './agenda.entidad.js';
import { CambioAgenda } from './cambioAgenda.entidad.js';
import { ConflictError, ForbiddenError } from '../../shared/errores.js';
import { fechaLocal, generarIntervalos, type BloqueHorario } from './horarios.js';

export const datosBloque = (b: BloqueHorario) => ({ diaSemana: b.diaSemana, horaInicio: b.horaInicio, horaFin: b.horaFin, duracionTurnoMinutos: b.duracionTurnoMinutos, terminaDiaSiguiente: b.terminaDiaSiguiente ?? false });

export async function bloquearDoctor(tx: EntityManager, matricula: number) {
  return tx.findOneOrFail(Doctor, { matricula }, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true });
}
export function autorizarAgenda(doctor: Doctor, usuario: { id: number; rol: string }) {
  if (usuario.rol !== 'admin' && (usuario.rol !== 'doctor' || doctor.usuario.id !== usuario.id)) throw new ForbiddenError('Solo podés administrar tu propia agenda');
}

// Se recupera únicamente cuando hay una coincidencia inequívoca. Nunca se inventa una duración.
export async function recuperarDuraciones(tx: EntityManager, doctor: Doctor) {
  const bloques = await tx.find(Agenda, { doctor });
  const turnos = await tx.find(Turno, { doctor, duracionTurnoMinutos: null });
  for (const turno of turnos) {
    const candidatas = new Set(generarIntervalos(bloques, fechaLocal(turno.fechaHoraTurno))
      .filter(s => +s.inicio === +turno.fechaHoraTurno).map(s => s.duracion));
    if (candidatas.size === 1) turno.duracionTurnoMinutos = [...candidatas][0];
  }
}
export async function impactoAgenda(tx: EntityManager, doctor: Doctor, bloques: BloqueHorario[]) {
  const turnos = await tx.find(Turno, { doctor, estado: 'pendiente', fechaHoraTurno: { $gte: new Date() } }, { orderBy: { id: 'asc' }, refresh: true });
  const sinDuracion = turnos.filter(t => !t.duracionTurnoMinutos);
  if (sinDuracion.length) throw new ConflictError(`Hay turnos históricos sin duración verificable (${sinDuracion.map(t => t.id).join(', ')}). Completá sus duraciones antes de cambiar la agenda.`);
  const excepciones = turnos.filter(t => !generarIntervalos(bloques, fechaLocal(t.fechaHoraTurno)).some(s => +s.inicio === +t.fechaHoraTurno && s.duracion === t.duracionTurnoMinutos))
    .map(t => ({ id: t.id, fechaHoraTurno: t.fechaHoraTurno, duracionTurnoMinutos: t.duracionTurnoMinutos }));
  const token = createHash('sha256').update(JSON.stringify({ version: doctor.versionAgenda, bloques: bloques.map(datosBloque), excepciones })).digest('hex');
  return { excepciones, token, version: doctor.versionAgenda };
}
export function registrarCambio(tx: EntityManager, doctor: Doctor, usuarioId: number, bloques: BloqueHorario[]) {
  doctor.versionAgenda++;
  tx.create(CambioAgenda, { doctor, usuarioId, version: doctor.versionAgenda, fecha: new Date(), bloques: bloques.map(datosBloque) });
}
