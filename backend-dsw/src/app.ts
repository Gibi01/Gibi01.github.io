import express from 'express';
import 'reflect-metadata';
import cors from 'cors';
import morgan from 'morgan';
import { orm, syncSchema } from './shared/orm.js';
import { RequestContext } from '@mikro-orm/core';
import { config } from './shared/config.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/manejadorErrores.js';

import { toNodeHandler } from 'better-auth/node';
import { auth } from './shared/auth.js';
import usuarioRouter from './recursos/usuarios/usuario.rutas.js';
import doctorRouter from './recursos/doctor/doctor.rutas.js';
import especialidadRouter from './recursos/especialidad/especialidad.rutas.js';
import turnoRouter from './recursos/turno/turno.rutas.js';
import agendaRouter from './recursos/agenda/agenda.rutas.js';
import obraSocialRouter from './recursos/obraSocial/obraSocial.rutas.js';
import motivoCancelacionRouter from './recursos/motivoCancelacion/motivoCancelacion.rutas.js';
import { iniciarTareaNoAsistidos } from './recursos/turno/turno.controlador.js';
import { iniciarNotificacionesTurnos, despacharNotificacionesTurnos } from './recursos/turno/notificacionTurno.servicio.js';

export const app = express();
app.use(cors({ origin: config.auth.origin, credentials: true }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', async (_req, res) => {
  await orm.em.getConnection().execute('select 1');
  res.set('Cache-Control', 'no-store').json({ status: 'ok' });
});
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.once('finish', () => { void despacharNotificacionesTurnos(); });
  }
  next();
});
app.all('/api/auth/*splat', toNodeHandler(auth));
// subimos el limite de 100kb a 5mb porque la foto de perfil viaja en base64 en el body
app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

app.use(morgan('dev'));

app.use('/api/usuarios', usuarioRouter);
app.use('/api/doctores', doctorRouter);
app.use('/api/especialidades', especialidadRouter);
app.use('/api/turnos', turnoRouter);
app.use('/api/agendas', agendaRouter);
app.use('/api/obras-sociales', obraSocialRouter);
app.use('/api/motivos-cancelacion', motivoCancelacionRouter);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

if (process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV !== 'production') await syncSchema();
  iniciarTareaNoAsistidos(); // cada 5min pasa los turnos vencidos de pendiente a no_asistido
  iniciarNotificacionesTurnos();

  app.listen(config.port, () => {
    console.log(`servidor escuchando en el puerto ${config.port}`);
  });
}
