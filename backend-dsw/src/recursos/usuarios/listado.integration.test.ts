import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { app } = await import('../../../dist/app.js');
const { orm } = await import('../../../dist/shared/orm.js');
const { auth, authPool } = await import('../../../dist/shared/auth.js');
const { Usuario } = await import('../../../dist/recursos/usuarios/usuario.entidad.js');
const email = `listado.${Date.now()}@example.com`;

let cookie: string;

beforeAll(async () => {
  await auth.api.createUser({ body: { email, password: 'test-iconos-123', name: 'Admin', role: 'admin', data: { apellido: 'Iconos', dni: 'ICONOS' } } });
  const res = await request(app).post('/api/auth/sign-in/email').send({ email, password: 'test-iconos-123' });
  expect(res.status).toBe(200);
  cookie = res.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => {
  const em = orm.em.fork();
  const usuario = await em.findOne(Usuario, { email });
  if (usuario) {
    for (const tabla of ['auth_session', 'auth_account']) await authPool.execute(`DELETE FROM ${tabla} WHERE userId = ?`, [usuario.authUserId]);
    await authPool.execute('DELETE FROM auth_user WHERE id = ?', [usuario.authUserId]);
    await em.removeAndFlush(usuario);
  }
  await authPool.end();
  await orm.close();
});


it('protege el listado y devuelve fecha de alta y estado sin credenciales', async () => {
  await request(app).get('/api/usuarios/listado').expect(401);
  const res = await request(app).get('/api/usuarios/listado').set('Cookie', cookie).expect(200);
  const usuario = res.body.data.find((u: { email: string }) => u.email === email);
  expect(usuario).toMatchObject({ rol: 'admin', activo: true });
  expect(Number.isNaN(Date.parse(usuario.fechaAlta))).toBe(false);
  expect(Object.keys(usuario).sort()).toEqual(['id','nombre','apellido','email','rol','activo','fechaAlta'].sort());
});

it('protege perfil e historial, pagina y separa reservas personales de la atención profesional', async () => {
  const { Doctor } = await import('../../../dist/recursos/doctor/doctor.entidad.js');
  const { Turno } = await import('../../../dist/recursos/turno/turno.entidad.js');
  const em = orm.em.fork();
  const usuario = await em.findOneOrFail(Usuario, { email });
  const otro = em.create(Usuario, { authUserId: `historial-${Date.now()}`, nombre: 'Otro', apellido: 'Paciente', email: `otro.${email}`, rol: 'paciente', dni: '12345678' });
  const matricula = 980000 + Math.floor(Math.random() * 5000);
  const doctor = em.create(Doctor, { matricula, usuario, activo: false });
  const otroDoctor = em.create(Doctor, { matricula: matricula + 10000, usuario: otro, activo: true });
  const turnos = Array.from({ length: 12 }, (_, i) => em.create(Turno, { usuario, doctor: otroDoctor,
    fechaHoraEmision: new Date(), fechaHoraTurno: new Date(`2030-01-${String(i + 1).padStart(2, '0')}T10:00:00-03:00`), duracionTurnoMinutos: 20, estado: i === 0 ? 'cancelado' : 'pendiente' }));
  const atendido = em.create(Turno, { usuario: otro, doctor, fechaHoraEmision: new Date(), fechaHoraTurno: new Date('2030-01-02T14:00:00-03:00'), duracionTurnoMinutos: 30, estado: 'asistido' });
  try {
    await em.flush();
    const base = `/api/usuarios/${usuario.id}`;
    for (const ruta of ['perfil-admin', 'turnos-admin']) await request(app).get(`${base}/${ruta}`).expect(401);
    const perfil = await request(app).get(`${base}/perfil-admin`).set('Cookie', cookie).expect(200);
    expect(perfil.body.data).toMatchObject({ id: usuario.id, activo: false, doctor: { matricula, activo: false } });
    expect(perfil.body.data).not.toHaveProperty('authUserId');
    const historial = await request(app).get(`${base}/turnos-admin`).set('Cookie', cookie).expect(200);
    expect(historial.body.data.total).toBe(12);
    expect(historial.body.data.turnos).toHaveLength(10);
    expect(historial.body.data.turnos.every((t: { usuarioId: number }) => t.usuarioId === usuario.id)).toBe(true);
    const segunda = await request(app).get(`${base}/turnos-admin?pagina=1`).set('Cookie', cookie).expect(200);
    expect(segunda.body.data.turnos).toHaveLength(2);
    const profesional = await request(app).get(`${base}/turnos-admin?perspectiva=profesional`).set('Cookie', cookie).expect(200);
    expect(profesional.body.data.turnos.map((t: { id: number }) => t.id)).toEqual([atendido.id]);
    const cancelados = await request(app).get(`${base}/turnos-admin?estado=cancelado`).set('Cookie', cookie).expect(200);
    expect(cancelados.body.data.total).toBe(1);
    const calendario = await request(app).get(`${base}/turnos-admin?vista=calendario&desde=2030-01-01T00:00:00Z&hasta=2030-02-01T00:00:00Z`).set('Cookie', cookie).expect(200);
    expect(calendario.body.data.turnos).toHaveLength(12);
    await request(app).get(`${base}/turnos-admin?vista=calendario&desde=mal&hasta=mal`).set('Cookie', cookie).expect(400);
    for (const rol of ['paciente', 'doctor']) {
      await authPool.execute('UPDATE auth_user SET role = ? WHERE id = ?', [rol, usuario.authUserId]);
      for (const ruta of ['perfil-admin', 'turnos-admin']) await request(app).get(`${base}/${ruta}`).set('Cookie', cookie).expect(403);
    }
  } finally {
    await authPool.execute('UPDATE auth_user SET role = ? WHERE id = ?', ['admin', usuario.authUserId]);
    await em.nativeDelete(Turno, { doctor: { matricula: { $in: [matricula, matricula + 10000] } } });
    await em.nativeDelete(Doctor, { matricula: { $in: [matricula, matricula + 10000] } });
    await em.nativeDelete(Usuario, { id: otro.id });
  }
});

it('incluye médicos dados de baja', async () => {
  const { Doctor } = await import('../../../dist/recursos/doctor/doctor.entidad.js');
  const em = orm.em.fork();
  const usuario = await em.findOneOrFail(Usuario, { email });
  const doctor = em.create(Doctor, { matricula: 990000 + Math.floor(Math.random()*9000), usuario, activo: false });
  try {
    await em.persistAndFlush(doctor);
    const res = await request(app).get('/api/usuarios/listado').set('Cookie', cookie).expect(200);
    expect(res.body.data.find((u: { email: string }) => u.email === email).activo).toBe(false);
  } finally {
    await em.nativeDelete(Doctor, { matricula: doctor.matricula });
  }
});

it('deniega el listado a pacientes y médicos', async () => {
  const usuario = await orm.em.fork().findOneOrFail(Usuario, { email });
  try {
    for (const rol of ['paciente', 'doctor']) {
      await authPool.execute('UPDATE auth_user SET role = ? WHERE id = ?', [rol, usuario.authUserId]);
      await request(app).get('/api/usuarios/listado').set('Cookie', cookie).expect(403);
    }
  } finally {
    await authPool.execute('UPDATE auth_user SET role = ? WHERE id = ?', ['admin', usuario.authUserId]);
  }
});

it('incluye cuentas bloqueadas y considera los bloqueos vencidos activos', async () => {
  const cuenta = await auth.api.createUser({ body: { email: `bloqueado.${email}`, password: 'test-listado-123', name: 'Paciente', role: 'paciente', data: { apellido: 'Listado', dni: 'LISTADO' } } });
  try {
    await authPool.execute('UPDATE auth_user SET banned = 1, banExpires = NULL WHERE id = ?', [cuenta.user.id]);
    let res = await request(app).get('/api/usuarios/listado').set('Cookie', cookie).expect(200);
    expect(res.body.data.find((u: { email: string }) => u.email === cuenta.user.email)).toMatchObject({ activo: false, rol: 'paciente' });
    await authPool.execute('UPDATE auth_user SET banExpires = ? WHERE id = ?', [new Date('2020-01-01'), cuenta.user.id]);
    res = await request(app).get('/api/usuarios/listado').set('Cookie', cookie).expect(200);
    expect(res.body.data.find((u: { email: string }) => u.email === cuenta.user.email).activo).toBe(true);
  } finally {
    for (const tabla of ['auth_session', 'auth_account']) await authPool.execute(`DELETE FROM ${tabla} WHERE userId = ?`, [cuenta.user.id]);
    await authPool.execute('DELETE FROM auth_user WHERE id = ?', [cuenta.user.id]);
    await orm.em.fork().nativeDelete(Usuario, { authUserId: cuenta.user.id });
  }
});
