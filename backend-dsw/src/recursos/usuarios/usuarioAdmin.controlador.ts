import type { Request, Response } from 'express';
import type { FilterQuery } from '@mikro-orm/core';
import type { RowDataPacket } from 'mysql2';
import { orm } from '../../shared/orm.js';
import { authPool } from '../../shared/auth.js';
import { BadRequestError, NotFoundError } from '../../shared/errores.js';
import { Usuario } from './usuario.entidad.js';
import { Doctor } from '../doctor/doctor.entidad.js';
import { Turno, type EstadoTurno } from '../turno/turno.entidad.js';

function idUsuario(req: Request) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestError('Usuario inválido');
  return id;
}

export async function perfilAdmin(req: Request, res: Response) {
  const id = idUsuario(req);
  const usuario = await orm.em.findOneOrFail(Usuario, { id });
  const doctor = await orm.em.findOne(Doctor, { usuario: id }, { populate: ['especialidades'] });
  const [cuentas] = await authPool.query<RowDataPacket[]>('SELECT createdAt, banned, banExpires FROM auth_user WHERE id = ?', [usuario.authUserId]);
  const cuenta = cuentas[0];
  const bloqueado = cuenta?.banned && (!cuenta.banExpires || new Date(cuenta.banExpires) > new Date());
  res.json({ data: {
    id, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, rol: usuario.rol,
    dni: usuario.dni ?? null, telefonoCelular: usuario.telefonoCelular ?? null, direccion: usuario.direccion ?? null,
    fechaAlta: cuenta?.createdAt ?? null, activo: !bloqueado && doctor?.activo !== false,
    doctor: doctor ? { matricula: doctor.matricula, activo: doctor.activo,
      especialidades: doctor.especialidades.getItems().map(e => ({ idEspecialidad: e.idEspecialidad, descripcionEsp: e.descripcionEsp })) } : null,
  } });
}

export async function historialAdmin(req: Request, res: Response) {
  const id = idUsuario(req);
  if (!await orm.em.findOne(Usuario, { id })) throw new NotFoundError('Usuario no encontrado');
  const perspectiva = req.query.perspectiva ?? 'paciente';
  if (!['paciente', 'profesional'].includes(String(perspectiva))) throw new BadRequestError('Perspectiva inválida');
  const where: FilterQuery<Turno> = {};
  if (perspectiva === 'profesional') {
    const doctor = await orm.em.findOne(Doctor, { usuario: id });
    if (!doctor) throw new BadRequestError('El usuario no tiene perfil de médico');
    where.doctor = { matricula: doctor.matricula };
  } else where.usuario = id;
  const estado = req.query.estado;
  if (estado && estado !== 'todos') {
    if (!['pendiente', 'asistido', 'no_asistido', 'cancelado'].includes(String(estado))) throw new BadRequestError('Estado inválido');
    where.estado = estado as EstadoTurno;
  }
  const periodo = req.query.periodo ?? 'todos';
  if (!['todos', 'pasados', 'proximos'].includes(String(periodo))) throw new BadRequestError('Período inválido');
  const condiciones: FilterQuery<Turno>[] = [];
  if (periodo === 'pasados') condiciones.push({ fechaHoraTurno: { $lt: new Date() } });
  if (periodo === 'proximos') condiciones.push({ fechaHoraTurno: { $gte: new Date() } });
  const calendario = req.query.vista === 'calendario';
  let desde: Date | undefined;
  let hasta: Date | undefined;
  if (calendario) {
    desde = new Date(String(req.query.desde)); hasta = new Date(String(req.query.hasta));
    if (!Number.isFinite(+desde) || !Number.isFinite(+hasta) || +hasta <= +desde || +hasta - +desde > 100 * 86400000) throw new BadRequestError('Rango de calendario inválido (máximo 100 días)');
    condiciones.push({ fechaHoraTurno: { $gte: new Date(+desde - 86400000), $lt: hasta } });
  }
  if (condiciones.length) where.$and = condiciones;
  const pagina = Number(req.query.pagina ?? 0);
  if (!Number.isSafeInteger(pagina) || pagina < 0) throw new BadRequestError('Página inválida');
  const [filas, total] = await orm.em.findAndCount(Turno, where, {
    populate: ['usuario', 'doctor.usuario', 'doctor.especialidades', 'obraSocial', 'motivoCancelacionPreestablecido'],
    orderBy: { fechaHoraTurno: 'desc', id: 'desc' }, ...(calendario ? {} : { limit: 10, offset: pagina * 10 }),
  });
  const visibles = desde ? filas.filter(t => +t.fechaHoraTurno + (t.duracionTurnoMinutos ?? 1) * 60000 > +desde!) : filas;
  res.json({ data: { total: calendario ? visibles.length : total, pagina, turnos: visibles.map(t => ({
    id: t.id, usuarioId: t.usuario.id, fechaHoraTurno: t.fechaHoraTurno, fechaHoraEmision: t.fechaHoraEmision,
    duracionTurnoMinutos: t.duracionTurnoMinutos ?? null, estado: t.estado,
    fechaHoraCancelacion: t.fechaHoraCancelacion ?? null, motivoCancelacion: t.motivoCancelacion ?? null,
    motivoCancelacionPreestablecido: t.motivoCancelacionPreestablecido ? { id: t.motivoCancelacionPreestablecido.id, descripcion: t.motivoCancelacionPreestablecido.descripcion } : null,
    obraSocial: t.obraSocial ? { id: t.obraSocial.id, nombre: t.obraSocial.nombre } : null,
    paciente: { id: t.usuario.id, nombre: t.usuario.nombre, apellido: t.usuario.apellido, dni: t.usuario.dni ?? null, email: t.usuario.email, telefonoCelular: t.usuario.telefonoCelular ?? null },
    doctor: { matricula: t.doctor.matricula, nombre: t.doctor.usuario.nombre, apellido: t.doctor.usuario.apellido, activo: t.doctor.activo,
      especialidades: t.doctor.especialidades.getItems().map(e => ({ idEspecialidad: e.idEspecialidad, descripcionEsp: e.descripcionEsp })) },
  })) } });
}
