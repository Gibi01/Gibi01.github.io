import { Router } from "express"
import { perfilAdmin, historialAdmin } from './usuarioAdmin.controlador.js';
import {
  sanitizeusuarioInput,
  validarUsuarioCreacion,
  findAll,
  listado,
  findOne,
  me,
  add,
  update,
  remove,
} from "./usuario.controlador.js"
import { verificarSesion, autorizarRoles } from "../../shared/middlewares/auth.middleware.js"

export const usuarioRouter = Router()

usuarioRouter.get('/', verificarSesion, autorizarRoles('admin'), findAll);
usuarioRouter.get('/me', verificarSesion, me);
usuarioRouter.get('/listado', verificarSesion, autorizarRoles('admin'), listado);
usuarioRouter.get('/:id/perfil-admin', verificarSesion, autorizarRoles('admin'), perfilAdmin);
usuarioRouter.get('/:id/turnos-admin', verificarSesion, autorizarRoles('admin'), historialAdmin);
usuarioRouter.get('/:id', verificarSesion, findOne);
usuarioRouter.post('/', sanitizeusuarioInput, validarUsuarioCreacion, add);
usuarioRouter.put('/:id', verificarSesion, sanitizeusuarioInput, update);
usuarioRouter.patch('/:id', verificarSesion, sanitizeusuarioInput, update);
usuarioRouter.delete('/:id', verificarSesion, autorizarRoles('admin'), remove);

export default usuarioRouter
