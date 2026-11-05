import { MikroORM } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { SqlHighlighter } from "@mikro-orm/sql-highlighter";
import { config } from "./config.js";

// en test hay que sacar entitiesTs, sino mikroorm intenta importar los .ts directo y en windows
// explota con un error de ESM. en dev/prod queda igual, no cambia nada
export const orm = await MikroORM.init({
  entities: ['dist/**/*.entidad.js'],
  ...(process.env.NODE_ENV === 'test' ? {} : { entitiesTs: ['src/**/*.entidad.ts'] }),
  dbName: config.db.name,
  driver: MySqlDriver,
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  driverOptions: { connection: { ssl: config.db.ssl } },
  pool: { min: 0, max: 5 },
  highlighter: new SqlHighlighter(),
  debug: process.env.ORM_DEBUG === 'true',
  schemaGenerator: {
    disableForeignKeys: true, // asi no tira error al borrar tablas con relaciones
    createForeignKeyConstraints: true, // pero si crea las fk al generar el esquema
    ignoreSchema: [],
    skipTables: [/^auth_/],
  },
});

export const syncSchema = async () => {
  const generator = orm.getSchemaGenerator();
  /*
  await generator.dropSchema()
  await generator.createSchema()
  */
  await generator.updateSchema();
};
