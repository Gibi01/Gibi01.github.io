import { describe, expect, it } from 'vitest';
import { validarBloques, generarIntervalos, seSuperponen } from './horarios.js';

const bloque = { diaSemana: 1, horaInicio: '22:00', horaFin: '02:00', terminaDiaSiguiente: true, duracionTurnoMinutos: 30 };
describe('Disponibilidad semanal', () => {
  it('continúa un bloque nocturno al día siguiente', () => {
    const slots = generarIntervalos([bloque], '2026-11-03');
    expect(slots).toHaveLength(4);
    expect(slots[0].inicio.toISOString()).toBe('2026-11-03T03:00:00.000Z');
  });
  it('detecta superposiciones entre domingo y lunes', () => {
    expect(() => validarBloques([{ ...bloque, diaSemana: 0 }, { ...bloque, horaInicio: '01:00', horaFin: '03:00', terminaDiaSiguiente: false }])).toThrow(/superponen/);
  });
  it('permite bloques consecutivos', () => {
    expect(() => validarBloques([bloque, { ...bloque, diaSemana: 2, horaInicio: '02:00', horaFin: '03:00', terminaDiaSiguiente: false }])).not.toThrow();
  });
  it('rechaza intervalos incompletos y campos vacíos', () => {
    expect(() => validarBloques([{ ...bloque, horaFin: '02:10' }])).toThrow();
    expect(() => validarBloques([{ ...bloque, diaSemana: null } as never])).toThrow();
  });
  it('no ofrece un turno que termina después del bloque', () => {
    const slots = generarIntervalos([{ ...bloque, horaInicio: '23:45', horaFin: '00:15' }], '2026-11-02');
    expect(slots).toHaveLength(1);
    expect(slots[0].fin.toISOString()).toBe('2026-11-03T03:15:00.000Z');
  });
  it('compara intervalos, no solamente horas de inicio', () => {
    expect(seSuperponen(0, 30, 15, 45)).toBe(true);
    expect(seSuperponen(0, 30, 30, 60)).toBe(false);
  });
});
