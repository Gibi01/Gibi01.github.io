import { LockMode, type EntityManager } from '@mikro-orm/core';
import { orm } from '../../shared/orm.js';
import { config } from '../../shared/config.js';
import { Turno } from './turno.entidad.js';
import { NotificacionTurno, type TipoNotificacionTurno } from './notificacionTurno.entidad.js';

const HORAS_RECORDATORIO = 24;
const MINUTO = 60_000;
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

function fechaLegible(fecha: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(fecha);
}

function contenido(turno: Turno, tipo: TipoNotificacionTurno): { asunto: string; texto: string } {
  const profesional = `Dr./Dra. ${turno.doctor.usuario.nombre} ${turno.doctor.usuario.apellido}`;
  const detalle = `Turno del ${fechaLegible(turno.fechaHoraTurno)} con ${profesional}.`;
  switch (tipo) {
    case 'recordatorio':
      return { asunto: 'Recordatorio de tu turno', texto: `Hola ${turno.usuario.nombre}: te recordamos tu próximo turno. ${detalle}` };
    case 'asistido':
      return { asunto: 'Confirmación de asistencia a tu turno', texto: `Hola ${turno.usuario.nombre}: tu turno fue marcado como asistido. ${detalle}` };
    case 'no_asistido':
      return { asunto: 'Tu turno fue marcado como no asistido', texto: `Hola ${turno.usuario.nombre}: tu turno fue marcado como no asistido. ${detalle}` };
    case 'cancelado':
      return { asunto: 'Confirmación de cancelación de turno', texto: `Hola ${turno.usuario.nombre}: tu turno fue cancelado. ${detalle} Motivo: ${turno.motivoCancelacion || 'Cancelación solicitada'}.` };
  }
}

// Se crea junto con el cambio de estado y se persiste en el mismo flush/transaction.
export function encolarNotificacion(em: EntityManager, turno: Turno, tipo: TipoNotificacionTurno): void {
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

async function encolarRecordatorios(): Promise<void> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + HORAS_RECORDATORIO * 60 * MINUTO);
  const em = orm.em.fork();
  const turnos = await em.find(Turno, {
    estado: 'pendiente',
    fechaHoraTurno: { $gt: ahora, $lte: limite },
  }, { populate: ['usuario', 'doctor', 'doctor.usuario'] });

  for (const turno of turnos) {
    const trabajo = orm.em.fork();
    try {
      await trabajo.transactional(async (tx) => {
        const actual = await tx.findOne(Turno, { id: turno.id }, {
          populate: ['usuario', 'doctor', 'doctor.usuario'],
          lockMode: LockMode.PESSIMISTIC_WRITE,
        });
        if (!actual || actual.estado !== 'pendiente' || actual.fechaHoraTurno <= new Date()) return;
        const existente = await tx.findOne(NotificacionTurno, { turno: actual, tipo: 'recordatorio' });
        if (!existente) encolarNotificacion(tx, actual, 'recordatorio');
      });
    } catch (error) {
      // La restricción única resuelve la carrera si otra instancia creó el mismo trabajo.
      console.error(`No se pudo preparar el recordatorio del turno ${turno.id}`, error);
    }
  }
}

async function enviarConResend(notificacion: NotificacionTurno): Promise<string> {
  const apiKey = config.resend.apiKey;
  const from = config.resend.fromEmail;
  if (!apiKey || !from) throw new Error('Faltan RESEND_API_KEY o RESEND_FROM_EMAIL');

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `turno-${notificacion.turno.id}-${notificacion.tipo}`,
    },
    body: JSON.stringify({
      from,
      to: [notificacion.destinatario],
      subject: notificacion.asunto,
      text: notificacion.texto,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const resultado = await respuesta.json() as { id?: string; message?: string };
  if (!respuesta.ok || !resultado.id) {
    throw new Error(`Resend HTTP ${respuesta.status}: ${resultado.message ?? 'respuesta sin identificador'}`);
  }
  return resultado.id;
}

async function procesarNotificaciones(): Promise<void> {
  if (!config.resend.apiKey || !config.resend.fromEmail) return;

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
    if (notificacion.tipo === 'recordatorio' && (turno.estado !== 'pendiente' || turno.fechaHoraTurno <= new Date())) {
      await tx.nativeUpdate(NotificacionTurno, { id: trabajo.id, estado: 'procesando' }, { estado: 'omitido' });
      continue;
    }

    try {
      const resendId = await enviarConResend(notificacion);
      await tx.nativeUpdate(NotificacionTurno, { id: trabajo.id, estado: 'procesando' }, {
        estado: 'enviado',
        enviadaEn: new Date(),
        resendId,
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

export function iniciarNotificacionesTurnos(): void {
  if (!config.resend.apiKey || !config.resend.fromEmail) {
    console.warn('Recordatorios por correo desactivados: configurá RESEND_API_KEY y RESEND_FROM_EMAIL');
    return;
  }
  const ejecutar = async () => {
    if (ejecutando) return;
    ejecutando = true;
    try {
      await encolarRecordatorios();
      await procesarNotificaciones();
    } catch (error) {
      console.error('Error procesando notificaciones de turnos', error);
    } finally {
      ejecutando = false;
    }
  };
  void ejecutar();
  setInterval(() => { void ejecutar(); }, MINUTO);
}
