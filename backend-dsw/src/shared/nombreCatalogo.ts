import { BadRequestError } from './errores.js';

export function nombrePresentacion(valor: unknown): string {
  if (typeof valor !== 'string') throw new BadRequestError('El nombre debe ser un texto.');
  const nombre = valor.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!nombre || nombre.length > 150) throw new BadRequestError('Ingresá un nombre de entre 1 y 150 caracteres.');
  return nombre.replace(/\p{L}/u, letra => letra.toLocaleUpperCase('es-AR'));
}

export function claveNombre(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-AR');
}
