import { orm } from './orm.js';
import { Doctor } from '../recursos/doctor/doctor.entidad.js';
import { Turno } from '../recursos/turno/turno.entidad.js';
import { bloquearDoctor, recuperarDuraciones } from '../recursos/agenda/agenda.servicio.js';

try {
  await orm.getSchemaGenerator().updateSchema({ safe: true, dropTables: false });
  const doctores = await orm.em.fork().find(Doctor, {});
  for (const doc of doctores) {
    await orm.em.fork().transactional(async tx => recuperarDuraciones(tx, await bloquearDoctor(tx, doc.matricula)));
  }
  const pendientes = await orm.em.fork().find(Turno, { estado: 'pendiente', duracionTurnoMinutos: null, fechaHoraTurno: { $gte: new Date() } });
  console.log(`Calendario preparado. Reservas futuras que requieren revisión manual de duración: ${pendientes.length}`);
  if (pendientes.length) console.log(pendientes.map(t => ({ id: t.id, doctor: t.doctor.matricula, fecha: t.fechaHoraTurno })));
} finally { await orm.close(); }
