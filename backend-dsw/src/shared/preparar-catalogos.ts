import { orm } from './orm.js';
import { claveNombre, nombrePresentacion } from './nombreCatalogo.js';

const catalogos = [
  { tabla: 'especialidad', campo: 'descripcion_esp', id: 'id_especialidad' },
  { tabla: 'obra_social', campo: 'nombre', id: 'id' },
  { tabla: 'motivo_cancelacion', campo: 'descripcion', id: 'id' },
];

try {
  const conexion = orm.em.getConnection();
  // Verificar antes de modificar el esquema: nunca fusionar ni borrar registros automáticamente.
  for (const { tabla, campo } of catalogos) {
    const filas: Record<string, string>[] = await conexion.execute(`select ${campo} from ${tabla}`);
    const claves = new Set<string>();
    for (const fila of filas) {
      const clave = claveNombre(nombrePresentacion(fila[campo]));
      if (claves.has(clave)) throw new Error(`Duplicados en ${tabla}: ${fila[campo]}. Resolver antes de continuar.`);
      claves.add(clave);
    }
  }
  await orm.getSchemaGenerator().updateSchema({ safe: true, dropTables: false });
  await orm.em.fork().transactional(async tx => {
    for (const { tabla, campo, id } of catalogos) {
      const filas: Record<string, string>[] = await tx.getConnection().execute(`select ${id}, ${campo} from ${tabla} for update`, [], 'all', tx.getTransactionContext());
      for (const fila of filas) await tx.getConnection().execute(`update ${tabla} set nombre_normalizado = ? where ${id} = ?`, [claveNombre(fila[campo]), fila[id]], 'run', tx.getTransactionContext());
    }
  });
  console.log('Catálogos protegidos contra duplicados. Nombres e identificadores existentes conservados.');
} finally { await orm.close(); }
