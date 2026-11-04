import { expect, it } from 'vitest';
import { nombrePresentacion, claveNombre } from './nombreCatalogo.js';

it('pone la primera letra en mayúscula y conserva las siglas', () => {
  expect(nombrePresentacion('  clínica   médica ')).toBe('Clínica médica');
  expect(nombrePresentacion('OSDE')).toBe('OSDE');
  expect(nombrePresentacion('imprevisto personal')).toBe('Imprevisto personal');
});
it('detecta equivalencias con tildes, espacios y mayúsculas', () => {
  expect(claveNombre('  CARDIOLOGÍA ')).toBe(claveNombre('cardiologia'));
  expect(claveNombre('clínica   médica')).toBe(claveNombre('Clinica medica'));
  expect(claveNombre('PAMI')).not.toBe(claveNombre('OSDE'));
});
it('rechaza valores vacíos, inválidos y demasiado largos', () => {
  for (const valor of [null, 123, {}, '  ', 'a'.repeat(151)]) expect(() => nombrePresentacion(valor)).toThrow();
});
