import { Router } from 'express';
import { estado, previsualizar, guardarSemana, completarDuracion } from './agenda.controlador.js';
import {
  sanitizeAgendaInput,
  validarAgendaCreacion,
  findAll,
  findOne,
  add,
  update,
  remove,
} from './agenda.controlador.js';
import { verificarSesion, autorizarRoles } from '../../shared/middlewares/auth.middleware.js';

export const agendaRouter = Router();

agendaRouter.get('/semanal/:doctorId', verificarSesion, autorizarRoles('admin', 'doctor'), estado);
agendaRouter.post('/semanal/:doctorId/previsualizar', verificarSesion, autorizarRoles('admin', 'doctor'), previsualizar);
agendaRouter.put('/semanal/:doctorId', verificarSesion, autorizarRoles('admin', 'doctor'), guardarSemana);
agendaRouter.patch('/semanal/:doctorId/duraciones/:turnoId', verificarSesion, autorizarRoles('admin', 'doctor'), completarDuracion);

agendaRouter.get('/', findAll);
agendaRouter.get('/:id', findOne);
agendaRouter.post('/', verificarSesion, autorizarRoles('admin', 'doctor'), sanitizeAgendaInput, validarAgendaCreacion, add);
agendaRouter.put('/:id', verificarSesion, autorizarRoles('admin', 'doctor'), sanitizeAgendaInput, update);
agendaRouter.patch('/:id', verificarSesion, autorizarRoles('admin', 'doctor'), sanitizeAgendaInput, update);
agendaRouter.delete('/:id', verificarSesion, autorizarRoles('admin', 'doctor'), remove);

export default agendaRouter;
