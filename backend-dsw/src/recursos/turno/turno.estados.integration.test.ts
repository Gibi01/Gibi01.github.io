// test de integracion, cubre todo el circuito de doctor-como-usuario, agenda propia,
// reserva de turno y los 4 estados (pendiente/asistido/no_asistido/cancelado).
// mismo approach que especialidad.integration.test.ts (importa desde dist/, ver ese archivo
// para el porque), y necesita mysql real levantado
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import 'dotenv/config';

process.env.NODE_ENV = 'test';
const { auth, authPool } = await import('../../../dist/shared/auth.js');

const { app } = await import('../../../dist/app.js');
const { orm } = await import('../../../dist/shared/orm.js');
const { Especialidad } = await import('../../../dist/recursos/especialidad/especialidad.entidad.js');
const { Doctor } = await import('../../../dist/recursos/doctor/doctor.entidad.js');
const { Usuario } = await import('../../../dist/recursos/usuarios/usuario.entidad.js');
const { Agenda } = await import('../../../dist/recursos/agenda/agenda.entidad.js');
const { Turno } = await import('../../../dist/recursos/turno/turno.entidad.js');
const { NotificacionTurno } = await import('../../../dist/recursos/turno/notificacionTurno.entidad.js');
const { ObraSocial } = await import('../../../dist/recursos/obraSocial/obraSocial.entidad.js');

const sufijo = Date.now();
const MATRICULA = 900000 + (sufijo % 1000);
const EMAIL_DOCTOR = `doctor.test.${sufijo}@example.com`;
let EMAIL_PACIENTE = `paciente.test.${sufijo}@example.com`;

const EMAIL_ADMIN = `admin.test.${sufijo}@example.com`;
let cookieAdmin: string;

function fechaManana(): { fecha: string; diaSemana: number } {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const anio = manana.getFullYear();
  const mes = String(manana.getMonth() + 1).padStart(2, '0');
  const dia = String(manana.getDate()).padStart(2, '0');
  return { fecha: `${anio}-${mes}-${dia}`, diaSemana: manana.getDay() };
}

let idEspecialidad: number;
let idObraSocial: number;
let cookieDoctor: string;
let cookiePaciente: string;
let agendaId: number;
let turnoAsistidoId: number;
let turnoNoAsistidoId: number;

async function limpiar() {
  const em = orm.em.fork();
  await em.nativeDelete(NotificacionTurno, { turno: { doctor: MATRICULA } });
  await em.nativeDelete(Turno, { doctor: MATRICULA });
  await em.nativeDelete(Agenda, { doctor: MATRICULA });
  await em.nativeDelete(Doctor, { matricula: MATRICULA });
  const cuentas = await em.find(Usuario, { email: { $in: [EMAIL_DOCTOR, EMAIL_PACIENTE, EMAIL_ADMIN] } });
  for (const cuenta of cuentas) {
    await authPool.execute('DELETE FROM auth_session WHERE userId = ?', [cuenta.authUserId]);
    await authPool.execute('DELETE FROM auth_account WHERE userId = ?', [cuenta.authUserId]);
    await authPool.execute('DELETE FROM auth_user WHERE id = ?', [cuenta.authUserId]);
  }
  await em.nativeDelete(Usuario, { email: { $in: [EMAIL_DOCTOR, EMAIL_PACIENTE, EMAIL_ADMIN] } });
  await em.nativeDelete(Especialidad, { descripcionEsp: `Especialidad test ${sufijo}` });
  await em.nativeDelete(ObraSocial, { nombre: `Obra social test ${sufijo}` });
}

beforeAll(async () => {
  await limpiar();
  await auth.api.createUser({ body: { email: EMAIL_ADMIN, password: '12345678', name: 'Admin', role: 'admin', data: { apellido: 'Test', dni: '12345678' } } });
  const res = await request(app).post('/api/auth/sign-in/email').send({ email: EMAIL_ADMIN, password: '12345678' });
  expect(res.status).toBe(200);
  cookieAdmin = res.headers['set-cookie'][0].split(';')[0];
});
afterAll(async () => {
  await limpiar();
  await authPool.end();
  await orm.close();
});

describe('Doctor como usuario + estados de turno', () => {
  it('un admin crea la especialidad y el doctor (con cuenta propia)', async () => {
    const resEsp = await request(app)
      .post('/api/especialidades')
      .set('Cookie', `${cookieAdmin}`)
      .send({ descripcionEsp: `Especialidad test ${sufijo}` });
    expect(resEsp.status).toBe(201);
    idEspecialidad = resEsp.body.data.idEspecialidad;

    const resDoctor = await request(app)
      .post('/api/doctores')
      .set('Cookie', `${cookieAdmin}`)
      .send({
        matricula: MATRICULA,
        nombre: 'Raiden',
        apellido: 'Test',
        email: EMAIL_DOCTOR,
        password: '12345678',
        dni: `DOC${sufijo}`,
        especialidadIds: [idEspecialidad],
      });
    expect(resDoctor.status).toBe(201);
    expect(resDoctor.body.data.activo).toBe(true);
    expect(resDoctor.body.data.password).toBeUndefined();
  });

  it('un doctor sin agenda no se ofrece al público, pero el admin puede configurarlo', async () => {
    const publica = await request(app).get('/api/doctores');
    expect(publica.status).toBe(200);
    expect(publica.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(false);

    const admin = await request(app).get('/api/doctores').set('Cookie', cookieAdmin);
    expect(admin.status).toBe(200);
    expect(admin.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(true);

    const catalogoAdmin = await request(app).get('/api/doctores?conAgenda=true').set('Cookie', cookieAdmin);
    expect(catalogoAdmin.status).toBe(200);
    expect(catalogoAdmin.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(false);
  });

  it('el doctor puede loguearse con la cuenta creada', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: EMAIL_DOCTOR, password: '12345678' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('doctor');
    cookieDoctor = res.headers['set-cookie'][0].split(';')[0];
  });

  it('el doctor puede crear su propia agenda, pero no la de otro doctor', async () => {
    const { diaSemana } = fechaManana();
    const resPropia = await request(app)
      .post('/api/agendas')
      .set('Cookie', `${cookieDoctor}`)
      .send({ doctorId: MATRICULA, diaSemana, horaInicio: '08:00', horaFin: '12:00', duracionTurnoMinutos: 30 });
    expect(resPropia.status).toBe(201);
    agendaId = resPropia.body.data.id;

    const publica = await request(app).get('/api/doctores');
    expect(publica.status).toBe(200);
    expect(publica.body.data.filter((d: any) => d.matricula === MATRICULA)).toHaveLength(1);
    const catalogoAdmin = await request(app).get('/api/doctores?conAgenda=true').set('Cookie', cookieAdmin);
    expect(catalogoAdmin.status).toBe(200);
    expect(catalogoAdmin.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(true);

    const resAjena = await request(app)
      .post('/api/agendas')
      .set('Cookie', `${cookieDoctor}`)
      .send({ doctorId: MATRICULA + 1, diaSemana, horaInicio: '08:00', horaFin: '12:00', duracionTurnoMinutos: 30 });
    expect(resAjena.status).toBe(403);
  });

  it.each([
    { horaActual: '09:00', primerHorario: '09:00', cantidad: 6 },
    { horaActual: '09:15', primerHorario: '09:30', cantidad: 5 },
    { horaActual: '12:00', primerHorario: null, cantidad: 0 },
  ])('a las $horaActual solo ofrece horarios presentes o futuros y actualiza el calendario', async ({ horaActual, primerHorario, cantidad }) => {
    const { fecha } = fechaManana();
    const ahora = new Date(`${fecha}T${horaActual}:00`).getTime();
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(ahora);
    try {
      const rutasDiarias = [
        `/api/turnos/disponibilidad?doctorId=${MATRICULA}`,
        `/api/turnos/disponibilidad-especialidad?especialidadId=${idEspecialidad}`,
      ];
      for (const ruta of rutasDiarias) {
        const res = await request(app).get(`${ruta}&fecha=${fecha}`);
        expect(res.status).toBe(200);
        const horarios = res.body.data.map((slot: string | { fechaHoraTurno: string }) =>
          new Date(typeof slot === 'string' ? slot : slot.fechaHoraTurno).getTime()
        );
        expect(horarios).toHaveLength(cantidad);
        expect(horarios.every((horario: number) => horario >= ahora)).toBe(true);
        if (primerHorario) expect(horarios[0]).toBe(new Date(`${fecha}T${primerHorario}:00`).getTime());

        const anterior = new Date(`${fecha}T00:00:00`);
        anterior.setDate(anterior.getDate() - 7);
        const fechaAnterior = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}-${String(anterior.getDate()).padStart(2, '0')}`;
        const pasada = await request(app).get(`${ruta}&fecha=${fechaAnterior}`);
        expect(pasada.status).toBe(200);
        expect(pasada.body.data).toEqual([]);
      }

      const [anio, mes] = fecha.split('-').map(Number);
      for (const ruta of [
        `/api/turnos/disponibilidad-mes?doctorId=${MATRICULA}`,
        `/api/turnos/disponibilidad-mes-especialidad?especialidadId=${idEspecialidad}`,
      ]) {
        const res = await request(app).get(`${ruta}&anio=${anio}&mes=${mes}`);
        expect(res.status).toBe(200);
        expect(res.body.data.includes(fecha)).toBe(cantidad > 0);
        expect(res.body.data.every((dia: string) => dia >= fecha)).toBe(true);
      }
    } finally {
      reloj.mockRestore();
    }
  });

  it('la disponibilidad por especialidad nunca expone al Usuario del doctor (ni anidado)', async () => {
    const em = orm.em.fork();
    const perfil = await em.findOneOrFail(Usuario, { email: EMAIL_DOCTOR });
    perfil.foto = '/avatares-doctores/jetstream-sam.png';
    await em.flush();
    const { fecha } = fechaManana();
    const res = await request(app).get(
      `/api/turnos/disponibilidad-especialidad?especialidadId=${idEspecialidad}&fecha=${fecha}`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const cuerpoCrudo = JSON.stringify(res.body.data);
    // nada de esto tiene que aparecer, ni el hash de la contraseña ni el dni/direccion del
    // doctor ni la coleccion inversa "doctores" de la Especialidad anidada (el bug real era que
    // el identity map de mikroorm re-serializaba el ciclo Especialidad->doctores->Usuario entero)
    expect(cuerpoCrudo).not.toContain('password');
    expect(cuerpoCrudo).not.toContain('"usuario"');
    expect(cuerpoCrudo).not.toContain('"doctores"');
    expect(res.body.data[0].doctor.foto).toBe('/avatares-doctores/jetstream-sam.png');
    expect(res.body.data[0].doctor.especialidades[0]).toEqual({
      idEspecialidad,
      descripcionEsp: `Especialidad test ${sufijo}`,
    });
  });

  it('el calendario mensual permite consultar fechas disponibles sin iniciar sesión', async () => {
    const { fecha } = fechaManana();
    const [anio, mes] = fecha.split('-').map(Number);
    const rutas = [
      `/api/turnos/disponibilidad-mes?doctorId=${MATRICULA}`,
      `/api/turnos/disponibilidad-mes-especialidad?especialidadId=${idEspecialidad}`,
    ];
    for (const ruta of rutas) {
      const res = await request(app).get(`${ruta}&anio=${anio}&mes=${mes}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toContain(fecha);
    }
  });

  it('un paciente se registra, ve la disponibilidad y reserva dos turnos', async () => {
    const resObraSocial = await request(app)
      .post('/api/obras-sociales')
      .set('Cookie', `${cookieAdmin}`)
      .send({ nombre: `Obra social test ${sufijo}` });
    expect(resObraSocial.status).toBe(201);
    idObraSocial = resObraSocial.body.data.id;

    const resRegistro = await request(app).post('/api/usuarios').send({
      nombre: 'Paciente',
      rol: 'admin', // El registro público debe ignorar la elevación de privilegios.
      apellido: 'Test',
      email: EMAIL_PACIENTE,
      password: '12345678',
      dni: `PAC${sufijo}`,
      obraSocialIds: [idObraSocial],
    });
    expect(resRegistro.status).toBe(201);
    expect(resRegistro.body.data.rol).toBe('paciente');

    expect(resRegistro.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(resRegistro.headers['set-cookie'][0]).toContain(`Max-Age=${auth.options.session.expiresIn}`);
    cookiePaciente = resRegistro.headers['set-cookie'][0].split(';')[0];
    const perfil = await request(app).get('/api/usuarios/me').set('Cookie', cookiePaciente);
    expect(perfil.status).toBe(200);
    expect(perfil.body.data.id).toBe(resRegistro.body.data.id);

    const { fecha } = fechaManana();
    const resDisp = await request(app).get(`/api/turnos/disponibilidad?doctorId=${MATRICULA}&fecha=${fecha}`);
    expect(resDisp.status).toBe(200);
    expect(resDisp.body.data.length).toBeGreaterThanOrEqual(2);
    const [slotA, slotB] = resDisp.body.data;

    const resTurnoA = await request(app)
      .post('/api/turnos')
      .set('Cookie', `${cookiePaciente}`)
      .send({ doctorId: MATRICULA, fechaHoraTurno: slotA, obraSocialId: idObraSocial });
    expect(resTurnoA.status).toBe(201);
    expect(resTurnoA.body.data.estado).toBe('pendiente');
    expect(resTurnoA.body.data.obraSocial.id).toBe(idObraSocial);
    turnoAsistidoId = resTurnoA.body.data.id;

    const resTurnoB = await request(app)
      .post('/api/turnos')
      .set('Cookie', `${cookiePaciente}`)
      .send({ doctorId: MATRICULA, fechaHoraTurno: slotB, obraSocialId: idObraSocial });
    expect(resTurnoB.status).toBe(201);
    turnoNoAsistidoId = resTurnoB.body.data.id;
  });

  it('el doctor ve en "atiendo" los turnos pendientes con los datos del paciente', async () => {
    const res = await request(app)
      .get('/api/turnos/atiendo?estado=pendiente')
      .set('Cookie', `${cookieDoctor}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const turno = res.body.data.find((t: any) => t.id === turnoAsistidoId);
    expect(turno.paciente.email).toBe(EMAIL_PACIENTE);
    expect(turno.paciente.password).toBeUndefined();
  });

  it('el doctor solo puede marcar asistencia durante los 15 minutos posteriores al turno', async () => {
    const resAntesDelTurno = await request(app)
      .patch(`/api/turnos/${turnoAsistidoId}/asistio`)
      .set('Cookie', `${cookieDoctor}`);
    expect(resAntesDelTurno.status).toBe(409);

    // El turno ya empezó: evita depender del redondeo de segundos de MySQL.
    await orm.em.fork().nativeUpdate(Turno, { id: turnoAsistidoId }, {
      fechaHoraTurno: new Date(Date.now() - 60 * 1000),
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoAsistidoId}/asistio`)
      .set('Cookie', `${cookieDoctor}`);
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('asistido');

    const resCancelar = await request(app)
      .patch(`/api/turnos/${turnoAsistidoId}/cancelar`)
      .set('Cookie', `${cookiePaciente}`)
      .send({ motivoCancelacion: 'ya no hace falta' });
    expect(resCancelar.status).toBe(409);

    const resReAsistido = await request(app)
      .patch(`/api/turnos/${turnoAsistidoId}/asistio`)
      .set('Cookie', `${cookieDoctor}`);
    expect(resReAsistido.status).toBe(409);
  });

  it('el sistema marca como no asistido un turno pendiente luego de los 15 minutos de cortesía', async () => {
    const vencido = new Date(Date.now() - 16 * 60 * 1000);
    await orm.em.fork().nativeUpdate(Turno, { id: turnoNoAsistidoId }, { fechaHoraTurno: vencido });

    const res = await request(app)
      .get('/api/turnos/atiendo?estado=pendiente')
      .set('Cookie', `${cookieDoctor}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((turno: any) => turno.id === turnoNoAsistidoId)).toBe(false);

    const turno = await orm.em.fork().findOneOrFail(Turno, { id: turnoNoAsistidoId });
    expect(turno.estado).toBe('no_asistido');
  });

  it('un paciente no puede marcar turnos como asistidos (no es doctor)', async () => {
    const res = await request(app)
      .patch(`/api/turnos/${turnoNoAsistidoId}/asistio`)
      .set('Cookie', `${cookiePaciente}`);
    expect(res.status).toBe(403);
  });

  it('la especialidad lista al doctor activo sin exponer su cuenta', async () => {
    const res = await request(app).get(`/api/especialidades/${idEspecialidad}`);
    expect(res.status).toBe(200);
    const doctor = res.body.data.doctores.find((d: any) => d.matricula === MATRICULA);
    expect(doctor).toBeDefined();
    expect(doctor.password).toBeUndefined();
  });

  it('al eliminar el último bloque horario, el doctor deja de aparecer en el catálogo', async () => {
    const eliminar = await request(app).delete(`/api/agendas/${agendaId}`).set('Cookie', cookieDoctor);
    expect(eliminar.status).toBe(200);
    const publica = await request(app).get('/api/doctores');
    expect(publica.status).toBe(200);
    expect(publica.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(false);
    const catalogoAdmin = await request(app).get('/api/doctores?conAgenda=true').set('Cookie', cookieAdmin);
    expect(catalogoAdmin.status).toBe(200);
    expect(catalogoAdmin.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(false);
  });

  it('un admin da de baja al doctor: deja de ofrecerse como opción, sin borrarse', async () => {
    const resBaja = await request(app)
      .delete(`/api/doctores/${MATRICULA}`)
      .set('Cookie', `${cookieAdmin}`);
    expect(resBaja.status).toBe(200);

    const resListaPublica = await request(app).get('/api/doctores');
    expect(resListaPublica.body.data.some((d: any) => d.matricula === MATRICULA)).toBe(false);

    const resListaAdmin = await request(app)
      .get('/api/doctores')
      .set('Cookie', `${cookieAdmin}`);
    const doctorDadoDeBaja = resListaAdmin.body.data.find((d: any) => d.matricula === MATRICULA);
    expect(doctorDadoDeBaja).toBeDefined();
    expect(doctorDadoDeBaja.activo).toBe(false);

    const resFicha = await request(app).get(`/api/doctores/${MATRICULA}`);
    expect(resFicha.status).toBe(404);

    const { fecha } = fechaManana();
    const resDisp = await request(app).get(`/api/turnos/disponibilidad?doctorId=${MATRICULA}&fecha=${fecha}`);
    expect(resDisp.status).toBe(404);

    const resEsp = await request(app).get(`/api/especialidades/${idEspecialidad}`);
    expect(resEsp.body.data.doctores.some((d: any) => d.matricula === MATRICULA)).toBe(false);

    // los turnos ya reservados con este doctor siguen existiendo, no se borran
    const turnoSigueExistiendo = await orm.em.fork().findOne(Turno, { id: turnoAsistidoId });
    expect(turnoSigueExistiendo).not.toBeNull();
  });

  it('sincroniza el perfil y aplica cambios de rol a la sesión existente', async () => {
    const doctor = await orm.em.fork().findOneOrFail(Usuario, { email: EMAIL_DOCTOR });
    expect((await request(app).delete(`/api/usuarios/${doctor.id}`).set('Cookie', cookieAdmin)).status).toBe(409);
    expect((await request(app).post('/api/auth/admin/remove-user').set('Cookie', cookieAdmin).send({ userId: doctor.authUserId })).status).toBe(409);
    expect((await request(app).get('/api/doctores/mios').set('Cookie', cookieDoctor)).status).toBe(200);
    expect((await request(app).post('/api/auth/sign-in/email').send({ email: EMAIL_DOCTOR, password: '12345678' })).status).toBe(200);
    const perfil = await orm.em.fork().findOneOrFail(Usuario, { email: EMAIL_PACIENTE });
    const origenAjeno = await request(app).patch(`/api/usuarios/${perfil.id}`).set('Cookie', cookiePaciente)
      .set('Origin', 'https://otro-sitio.example').send({ direccion: 'Cambio no permitido' });
    expect(origenAjeno.status).toBe(403);
    const elevarRol = await request(app).patch(`/api/usuarios/${perfil.id}`).set('Cookie', cookiePaciente).send({ rol: 'admin' });
    expect(elevarRol.status).toBe(403);
    const nuevoEmail = `perfil.test.${sufijo}@example.com`;
    const editar = await request(app).patch(`/api/usuarios/${perfil.id}`).set('Cookie', cookiePaciente)
      .send({ email: nuevoEmail, nombre: 'Paciente actualizado', direccion: 'Dirección de prueba' });
    expect(editar.status).toBe(200);
    EMAIL_PACIENTE = nuevoEmail;
    expect(editar.body.data).toMatchObject({ email: nuevoEmail, nombre: 'Paciente actualizado', direccion: 'Dirección de prueba' });
    const sesion = await request(app).get('/api/auth/get-session').set('Cookie', cookiePaciente);
    expect(sesion.body.user).toMatchObject({ email: nuevoEmail, name: 'Paciente actualizado' });
    const dni = await request(app).post('/api/auth/update-user').set('Cookie', cookiePaciente).send({ dni: 'DNI modificado' });
    expect(dni.status).toBe(400);
    expect((await request(app).patch(`/api/usuarios/${perfil.id}`).set('Cookie', cookieAdmin).send({ rol: 'admin' })).status).toBe(200);
    expect((await request(app).get('/api/usuarios').set('Cookie', cookiePaciente)).status).toBe(200);
    expect((await request(app).patch(`/api/usuarios/${perfil.id}`).set('Cookie', cookieAdmin).send({ rol: 'paciente' })).status).toBe(200);
    expect((await request(app).get('/api/usuarios').set('Cookie', cookiePaciente)).status).toBe(403);
  });

  it('sin renovación: una sesión vencida y una sesión cerrada ya no permiten usar la API', async () => {
    const usuario = await orm.em.fork().findOneOrFail(Usuario, { email: EMAIL_PACIENTE });
    const antes = await request(app).get('/api/usuarios/me').set('Cookie', cookiePaciente);
    expect(antes.status).toBe(200);
    const [filas] = await authPool.execute('SELECT expiresAt, createdAt FROM auth_session WHERE userId = ?', [usuario.authUserId]);
    const sesion = (filas as any[])[0];
    expect(new Date(sesion.expiresAt).getTime() - new Date(sesion.createdAt).getTime()).toBe(auth.options.session.expiresIn * 1000);
    await authPool.execute('UPDATE auth_session SET expiresAt = ? WHERE userId = ?', [new Date(Date.now() - 60000), usuario.authUserId]);
    expect((await request(app).get('/api/usuarios/me').set('Cookie', cookiePaciente)).status).toBe(401);
    const ingreso = await request(app).post('/api/auth/sign-in/email').send({ email: EMAIL_PACIENTE, password: '12345678' });
    expect(ingreso.status).toBe(200);
    const cookie = ingreso.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).post('/api/auth/sign-out').set('Cookie', cookie).send({})).status).toBe(200);
    expect((await request(app).get('/api/usuarios/me').set('Cookie', cookie)).status).toBe(401);
  });
});
