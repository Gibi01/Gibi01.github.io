import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import { createPool } from 'mysql2/promise';
import { config } from './config.js';
import { orm } from './orm.js';
import { Usuario } from '../recursos/usuarios/usuario.entidad.js';
import { Doctor } from '../recursos/doctor/doctor.entidad.js';
import { Turno } from '../recursos/turno/turno.entidad.js';

export const authPool = createPool({
  host: config.db.host, port: config.db.port, database: config.db.name,
  user: config.db.user, password: config.db.password, timezone: 'Z',
});

async function validarEliminacion(authUserId: string): Promise<void> {
  const em = orm.em.fork();
  const perfil = await em.findOne(Usuario, { authUserId });
  if (perfil && (await em.count(Doctor, { usuario: perfil.id }) || await em.count(Turno, { usuario: perfil.id }))) {
    throw new APIError('CONFLICT', { message: 'No se puede eliminar un usuario asociado a un doctor o a turnos' });
  }
}

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.origin,
  basePath: '/api/auth',
  trustedOrigins: [config.auth.origin],
  database: authPool,
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
  user: {
    modelName: 'auth_user',
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    additionalFields: {
      apellido: { type: 'string', required: true },
      dni: { type: 'string', required: true },
    },
  },
  session: {
    modelName: 'auth_session', expiresIn: 60 * 60  , //una hora
    disableSessionRefresh: true, cookieCache: { enabled: false },
  },
  account: { modelName: 'auth_account' },
  verification: { modelName: 'auth_verification' },
  plugins: [admin({
    defaultRole: 'paciente', adminRoles: ['admin'],
    roles: { admin: adminAc, paciente: userAc, doctor: userAc },
  })],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/admin/remove-user') return;
      const sesion = await getAuthoritativeSessionFromCtx(ctx);
      if (!sesion) throw new APIError('UNAUTHORIZED');
      if (sesion.user.role !== 'admin') throw new APIError('FORBIDDEN');
      // El endpoint de Better Auth borra sesiones y credenciales antes de user.delete.before.
      // Validar aquí evita perderlas cuando el perfil tiene relaciones de negocio.
      await validarEliminacion(String(ctx.body?.userId ?? ''));
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const datos = user as typeof user & { apellido?: string; dni?: string };
          if ([user.name, datos.apellido, datos.dni].some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) {
            throw new APIError('BAD_REQUEST', { message: 'Nombre, apellido y DNI son obligatorios (máximo 255 caracteres)' });
          }
        },
        after: async (user) => {
          const em = orm.em.fork();
          const datos = user as typeof user & { apellido: string; dni: string; role?: string };
          await em.persistAndFlush(em.create(Usuario, {
            authUserId: user.id, nombre: user.name, apellido: datos.apellido,
            dni: datos.dni, email: user.email, rol: datos.role ?? 'paciente',
          }));
        },
      },
      update: {
        before: async (user) => {
          if ('dni' in user) throw new APIError('BAD_REQUEST', { message: 'El DNI no se puede modificar' });
          for (const field of ['name', 'apellido'] as const) {
            const valor = user[field];
            if (valor !== undefined && (typeof valor !== 'string' || !valor.trim() || valor.length > 255)) {
              throw new APIError('BAD_REQUEST', { message: 'Nombre y apellido deben tener entre 1 y 255 caracteres' });
            }
          }
        },
        after: async (user) => {
          const em = orm.em.fork();
          const perfil = await em.findOneOrFail(Usuario, { authUserId: user.id });
          const datos = user as typeof user & { apellido: string; role?: string };
          em.assign(perfil, { nombre: user.name, apellido: datos.apellido, email: user.email, rol: datos.role ?? 'paciente' });
          await em.flush();
        },
      },
      delete: {
        before: async (user) => {
          await validarEliminacion(user.id);
        },
        after: async (user) => { await orm.em.fork().nativeDelete(Usuario, { authUserId: user.id }); },
      },
    },
  },
});
