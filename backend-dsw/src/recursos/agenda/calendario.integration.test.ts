import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import 'dotenv/config';
process.env.NODE_ENV = 'test';
const { app } = await import('../../../dist/app.js');
const { auth, authPool } = await import('../../../dist/shared/auth.js');
const { orm } = await import('../../../dist/shared/orm.js');
const { Doctor } = await import('../../../dist/recursos/doctor/doctor.entidad.js');
const { Usuario } = await import('../../../dist/recursos/usuarios/usuario.entidad.js');
const { Agenda } = await import('../../../dist/recursos/agenda/agenda.entidad.js');
const { Turno } = await import('../../../dist/recursos/turno/turno.entidad.js');
const { NotificacionTurno } = await import('../../../dist/recursos/turno/notificacionTurno.entidad.js');

const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const matricula = 950000 + Math.floor(Math.random() * 40000);
const correos = ['admin', 'doctor', 'paciente', 'paciente2'].map(r => `cal-${r}-${sufijo}@example.com`);
const cookies: string[] = [];
const fecha = '2030-11-04'; // lunes
const bloque = { diaSemana: 1, horaInicio: '09:00', horaFin: '12:00', duracionTurnoMinutos: 30, terminaDiaSiguiente: false };
let turnoId: number;
beforeAll(async () => {
  for (let i = 0; i < correos.length; i++) {
    await auth.api.createUser({ body: { email: correos[i], password: 'Test-12345678', name: 'Calendario', role: i === 0 ? 'admin' : i === 1 ? 'doctor' : 'paciente', data: { apellido: 'Test', dni: `CAL${sufijo}${i}` } } });
    const login = await request(app).post('/api/auth/sign-in/email').send({ email: correos[i], password: 'Test-12345678' });
    expect(login.status).toBe(200); cookies.push(login.headers['set-cookie'][0].split(';')[0]);
  }
  const em = orm.em.fork();
  const usuario = await em.findOneOrFail(Usuario, { email: correos[1] });
  em.create(Doctor, { matricula, usuario, activo: true }); await em.flush();
});
afterAll(async () => {
  const em = orm.em.fork();
  await em.nativeDelete(NotificacionTurno, { turno: { doctor: matricula } });
  await em.nativeDelete(Turno, { doctor: matricula });
  await em.nativeDelete(Agenda, { doctor: matricula });
  await em.nativeDelete(Doctor, { matricula });
  const usuarios = await em.find(Usuario, { email: { $in: correos } });
  for (const u of usuarios) {
    await authPool.execute('DELETE FROM auth_session WHERE userId = ?', [u.authUserId]);
    await authPool.execute('DELETE FROM auth_account WHERE userId = ?', [u.authUserId]);
    await authPool.execute('DELETE FROM auth_user WHERE id = ?', [u.authUserId]);
  }
  await em.nativeDelete(Usuario, { email: { $in: correos } });
  await authPool.end(); await orm.close();
});
const estado = () => request(app).get(`/api/agendas/semanal/${matricula}`).set('Cookie', cookies[1]);
const preview = (version: number, bloques: unknown[]) => request(app).post(`/api/agendas/semanal/${matricula}/previsualizar`).set('Cookie', cookies[1]).send({ version, bloques });
const guardar = (version: number, bloques: unknown[], token: string, aceptarExcepciones = true) => request(app).put(`/api/agendas/semanal/${matricula}`).set('Cookie', cookies[1]).send({ version, bloques, token, aceptarExcepciones });
describe('Calendario: reservas, reemplazo y baja', () => {
  it('protege el editor y guarda una semana completa', async () => {
    expect((await request(app).get(`/api/agendas/semanal/${matricula}`).set('Cookie', cookies[2])).status).toBe(403);
    const p = await preview(0, [bloque]); expect(p.status).toBe(200);
    expect((await guardar(0, [bloque], p.body.data.token)).status).toBe(200);
  });
  it('dos pacientes simultáneos producen una sola reserva', async () => {
    const resultados = await Promise.all([2, 3].map(i => request(app).post('/api/turnos').set('Cookie', cookies[i]).send({ doctorId: matricula, fechaHoraTurno: `${fecha}T09:00:00-03:00` })));
    expect(resultados.map(r => r.status).sort()).toEqual([201, 409]);
    const creado = resultados.find(r => r.status === 201)!;
    turnoId = creado.body.data.id;
    expect(creado.body.data.duracionTurnoMinutos).toBe(30);
    expect(await orm.em.fork().count(Turno, { doctor: matricula })).toBe(1);
  });
  it('reemplaza horarios conservando reservas, exige confirmación y evita solapamientos', async () => {
    const bloques = [{ ...bloque, horaInicio: '09:15', horaFin: '12:15' }];
    const version = (await estado()).body.data.version;
    const p = await preview(version, bloques);
    expect(p.body.data.excepciones.map((t: { id: number }) => t.id)).toEqual([turnoId]);
    expect((await guardar(version, bloques, p.body.data.token, false)).status).toBe(409);
    expect((await guardar(version, bloques, p.body.data.token)).status).toBe(200);
    const turno = await orm.em.fork().findOneOrFail(Turno, { id: turnoId });
    expect(turno.fechaHoraTurno.toISOString()).toBe(`${fecha}T12:00:00.000Z`);
    expect(turno.duracionTurnoMinutos).toBe(30);
    const disp = await request(app).get(`/api/turnos/disponibilidad?doctorId=${matricula}&fecha=${fecha}`);
    expect(disp.body.data).not.toContain(`${fecha}T12:15:00.000Z`);
    expect(disp.body.data).toContain(`${fecha}T12:45:00.000Z`);
    expect((await guardar(version, bloques, p.body.data.token)).status).toBe(409);
  });
  it('incluye el tramo del día anterior y rechaza bloques nocturnos superpuestos', async () => {
    const version = (await estado()).body.data.version;
    const nocturno = { ...bloque, horaInicio: '22:00', horaFin: '02:00', terminaDiaSiguiente: true };
    expect((await preview(version, [nocturno, { ...bloque, diaSemana: 2, horaInicio: '01:00', horaFin: '03:00' }])).status).toBe(400);
    const p = await preview(version, [nocturno]);
    expect((await guardar(version, [nocturno], p.body.data.token)).status).toBe(200);
    const disp = await request(app).get(`/api/turnos/disponibilidad?doctorId=${matricula}&fecha=2030-11-05`);
    expect(disp.body.data).toHaveLength(4);
    expect(disp.body.data[0]).toBe('2030-11-05T03:00:00.000Z');
  });
  it('la baja cancela reservas futuras y encola exactamente un correo por turno', async () => {
    expect((await request(app).delete(`/api/doctores/${matricula}`).set('Cookie', cookies[0])).status).toBe(200);
    expect((await request(app).delete(`/api/doctores/${matricula}`).set('Cookie', cookies[0])).status).toBe(200);
    const turno = await orm.em.fork().findOneOrFail(Turno, { id: turnoId });
    expect(turno.estado).toBe('cancelado'); expect(turno.motivoCancelacion).toBe('Baja del profesional');
    expect(await orm.em.fork().count(NotificacionTurno, { turno: turnoId, tipo: 'cancelado' })).toBe(1);
    expect((await request(app).post('/api/turnos').set('Cookie', cookies[2]).send({ doctorId: matricula, fechaHoraTurno: `${fecha}T22:00:00-03:00` })).status).toBe(404);
  });
});
