import { type EntityManager } from '@mikro-orm/core';
import { orm } from '../../shared/orm.js';
import { config } from '../../shared/config.js';
import { Turno } from './turno.entidad.js';
import { NotificacionTurno, type TipoNotificacionTurno } from './notificacionTurno.entidad.js';

import { enviarCorreo } from '../../shared/correo.js';
const MINUTO = 60_000;
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

function fechaLegible(fecha: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(fecha);
}

function contenido(turno: Turno, tipo: Exclude<TipoNotificacionTurno, 'recordatorio'>): { asunto: string; texto: string } {
  const profesional = `Dr./Dra. ${turno.doctor.usuario.nombre} ${turno.doctor.usuario.apellido}`;
  const detalle = `Turno del ${fechaLegible(turno.fechaHoraTurno)} con ${profesional}.`;
  switch (tipo) {
    case 'asistido':
      return { asunto: 'Confirmación de asistencia a tu turno', texto: `Hola ${turno.usuario.nombre}: tu turno fue marcado como asistido. ${detalle}` };
    case 'no_asistido':
      return { asunto: 'Tu turno fue marcado como no asistido', texto: `Hola ${turno.usuario.nombre}: tu turno fue marcado como no asistido. ${detalle}` };
    case 'cancelado':
      return { asunto: 'Confirmación de cancelación de turno', texto: `Hola ${turno.usuario.nombre}: tu turno fue cancelado. ${detalle} Motivo: ${turno.motivoCancelacion || 'Cancelación solicitada'}.` };
  }
}

// Se crea junto con el cambio de estado y se persiste en el mismo flush/transaction.
export function encolarNotificacion(em: EntityManager, turno: Turno, tipo: Exclude<TipoNotificacionTurno, 'recordatorio'>): void {
  const { asunto, texto } = contenido(turno, tipo);
  em.create(NotificacionTurno, {
    turno,
    tipo,
    destinatario: turno.usuario.email,
    asunto,
    texto,
    estado: 'pendiente',
    intentos: 0,
    creadaEn: new Date(),
    proximoIntentoEn: new Date(),
  });
}

async function procesarNotificaciones(): Promise<void> {
  if (!config.brevo.apiKey || !config.brevo.fromEmail) return;

  const ahora = new Date();
  const em = orm.em.fork();
  const trabajos = await em.find(NotificacionTurno, {
    estado: { $in: ['pendiente', 'procesando'] },
    proximoIntentoEn: { $lte: ahora },
  }, { orderBy: { creadaEn: 'asc' }, limit: 100 });

  for (const trabajo of trabajos) {
    const tx = orm.em.fork();
    const reclamados = await tx.nativeUpdate(NotificacionTurno, {
      id: trabajo.id,
      estado: { $in: ['pendiente', 'procesando'] },
      proximoIntentoEn: { $lte: new Date() },
    }, {
      estado: 'procesando',
      proximoIntentoEn: new Date(Date.now() + 10 * MINUTO),
    });
    if (reclamados !== 1) continue;

    const notificacion = await tx.findOneOrFail(NotificacionTurno, { id: trabajo.id }, { populate: ['turno'] });
    const turno = notificacion.turno;
    if (notificacion.tipo === 'recordatorio') {
      await tx.nativeUpdate(NotificacionTurno, { id: trabajo.id, estado: 'procesando' }, { estado: 'omitido' });
      continue;
    }

    try {
      const proveedorId = await enviarCorreo(notificacion);
      await tx.nativeUpdate(NotificacionTurno, { id: trabajo.id, estado: 'procesando' }, {
        estado: 'enviado',
        enviadaEn: new Date(),
        proveedorId,
        ultimoError: null,
      });
    } catch (error) {
      const intentos = notificacion.intentos + 1;
      const espera = Math.min(60, 2 ** Math.min(intentos, 6)) * MINUTO;
      await tx.nativeUpdate(NotificacionTurno, { id: trabajo.id, estado: 'procesando' }, {
        estado: 'pendiente',
        intentos,
        proximoIntentoEn: new Date(Date.now() + espera),
        ultimoError: String(error).slice(0, 1000),
      });
      console.error(`Falló el correo del turno ${turno.id} (${notificacion.tipo})`, error);
    }
  }
}

let ejecutando = false;

// Los recordatorios anticipados se retiraron: Render Free suspende el proceso
// sin tráfico y no garantiza ejecutar tareas a una hora determinada.
// La cola de cambios de estado se conserva y se retoma al despertar.
export async function despacharNotificacionesTurnos(): Promise<void> {
  if (ejecutando || !config.brevo.apiKey || !config.brevo.fromEmail) return;
  ejecutando = true;
  try {
    await procesarNotificaciones();
  } catch (error) {
    console.error('Error procesando notificaciones de turnos', error);
  } finally {
    ejecutando = false;
  }
}

export function iniciarNotificacionesTurnos(): void {
  if (!config.brevo.apiKey || !config.brevo.fromEmail) {
    console.warn('Correos desactivados: configurá BREVO_API_KEY y BREVO_FROM_EMAIL');
    return;
  }
  void despacharNotificacionesTurnos();
  setInterval(() => { void despacharNotificacionesTurnos(); }, MINUTO).unref();
}
