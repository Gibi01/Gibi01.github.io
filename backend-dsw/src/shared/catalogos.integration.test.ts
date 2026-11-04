import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { app } = await import('../../dist/app.js');
const { orm } = await import('../../dist/shared/orm.js');
const { auth, authPool } = await import('../../dist/shared/auth.js');
const { Usuario } = await import('../../dist/recursos/usuarios/usuario.entidad.js');
const marca = Date.now();
const email = `catalogos.${marca}@example.com`;
let cookie: string;
const creados: { tabla: string; campo: string; id: number }[] = [];

beforeAll(async () => {
  await auth.api.createUser({ body: { email, password: 'test-catalogos-123', name: 'Admin', role: 'admin', data: { apellido: 'Catálogos', dni: 'CATALOGOS' } } });
  const res = await request(app).post('/api/auth/sign-in/email').send({ email, password: 'test-catalogos-123' });
  expect(res.status).toBe(200);
  cookie = res.headers['set-cookie'][0].split(';')[0];
});
afterAll(async () => {
  const em = orm.em.fork();
  for (const r of creados) await em.getConnection().execute(`delete from ${r.tabla} where ${r.campo} = ?`, [r.id]);
  const usuario = await em.findOne(Usuario, { email });
  if (usuario) {
    for (const tabla of ['auth_session', 'auth_account']) await authPool.execute(`DELETE FROM ${tabla} WHERE userId = ?`, [usuario.authUserId]);
    await authPool.execute('DELETE FROM auth_user WHERE id = ?', [usuario.authUserId]);
    await em.removeAndFlush(usuario);
  }
  await authPool.end(); await orm.close();
});

for (const [ruta, campo, tabla, pk, respuestaId] of [
  ['especialidades', 'descripcionEsp', 'especialidad', 'id_especialidad', 'idEspecialidad'],
  ['obras-sociales', 'nombre', 'obra_social', 'id', 'id'],
  ['motivos-cancelacion', 'descripcion', 'motivo_cancelacion', 'id', 'id'],
]) {
  it(`${ruta}: capitaliza, rechaza duplicados simultáneos y protege también la edición`, async () => {
    const crear = (nombre: string) => request(app).post(`/api/${ruta}`).set('Cookie', cookie).send({ [campo]: nombre });
    const registrar = (res: request.Response) => {
      if (res.status === 201) creados.push({ tabla, campo: pk, id: res.body.data[respuestaId] });
      return res;
    };
    const nombre = `prueba clínica ${marca}`;
    const primero = registrar(await crear(`  ${nombre}  `));
    expect(primero.status).toBe(201);
    expect(primero.body.data[campo]).toBe(`Prueba clínica ${marca}`);
    expect(primero.body.data).not.toHaveProperty('nombreNormalizado');
    const duplicado = registrar(await crear(` PRUEBA   CLINICA ${marca} `));
    expect(duplicado.status).toBe(409);
    const otro = registrar(await crear(`otro ${marca}`));
    expect(otro.status).toBe(201);
    await request(app).patch(`/api/${ruta}/${otro.body.data[respuestaId]}`).set('Cookie', cookie).send({ [campo]: nombre }).expect(409);
    await request(app).patch(`/api/${ruta}/${primero.body.data[respuestaId]}`).set('Cookie', cookie).send({ [campo]: nombre }).expect(200);
    const simultaneos = (await Promise.all([crear(`simultánea ${marca}`), crear(`SIMULTANEA ${marca}`)])).map(registrar);
    expect(simultaneos.map(r => r.status).sort()).toEqual([201, 409]);
    for (const invalido of ['   ', 123, null]) await request(app).post(`/api/${ruta}`).set('Cookie', cookie).send({ [campo]: invalido }).expect(400);
  });
}
