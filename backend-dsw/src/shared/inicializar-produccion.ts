import { getMigrations } from 'better-auth/db/migration';
import { auth, authPool } from './auth.js';
import { orm } from './orm.js';

// Alta inicial explícita; nunca modifica ni reinicia una base que ya tenga tablas.
try {
  if (!process.argv.includes('--confirm-empty')) {
    throw new Error('Usá --confirm-empty únicamente para inicializar una base vacía');
  }
  const [tables] = await authPool.query('SHOW TABLES');
  if (!Array.isArray(tables) || tables.length) throw new Error('La base no está vacía; no se modificó');
  await orm.getSchemaGenerator().createSchema();
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  console.log('Base inicializada. Ejecutá auth:admin para crear el administrador.');
} finally {
  await authPool.end();
  await orm.close();
}
