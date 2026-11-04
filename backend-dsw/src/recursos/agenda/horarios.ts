import { BadRequestError } from '../../shared/errores.js';
export interface BloqueHorario {
  diaSemana: number; horaInicio: string; horaFin: string;
  terminaDiaSiguiente?: boolean; duracionTurnoMinutos: number;
}
export const MINUTO = 60_000;
const DIA = 1440;
const SEMANA = DIA * 7;
export const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
export const seSuperponen = (a: number, b: number, c: number, d: number) => a < d && c < b;
export function validarBloques(bloques: BloqueHorario[]) {
  if (!Array.isArray(bloques) || bloques.length > 100) throw new BadRequestError('La agenda admite hasta 100 bloques');
  const intervalos: { inicio: number; fin: number }[] = [];
  for (const b of bloques) {
    if (!b || !Number.isInteger(b.diaSemana) || b.diaSemana < 0 || b.diaSemana > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.horaInicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.horaFin) ||
        (b.terminaDiaSiguiente !== undefined && typeof b.terminaDiaSiguiente !== 'boolean')) throw new BadRequestError('Día u horario inválido');
    const duracion = minutos(b.horaFin) + (b.terminaDiaSiguiente ? DIA : 0) - minutos(b.horaInicio);
    if (duracion <= 0 || duracion > DIA || !Number.isInteger(b.duracionTurnoMinutos) || b.duracionTurnoMinutos <= 0 || duracion % b.duracionTurnoMinutos !== 0) {
      throw new BadRequestError('El bloque debe durar hasta 24 horas y contener turnos completos. Indicá si termina al día siguiente.');
    }
    const inicio = b.diaSemana * DIA + minutos(b.horaInicio);
    for (const anterior of intervalos) {
      if ([-SEMANA, 0, SEMANA].some(d => seSuperponen(inicio, inicio + duracion, anterior.inicio + d, anterior.fin + d))) throw new BadRequestError('Los bloques del profesional se superponen');
    }
    intervalos.push({ inicio, fin: inicio + duracion });
  }
}
// Horarios del sanatorio en Argentina (UTC-03), independientes de la zona del servidor.
export function fechaLocal(fecha: Date) { return new Date(fecha.getTime() - 3 * 60 * MINUTO).toISOString().slice(0, 10); }
export function generarIntervalos(bloques: BloqueHorario[], fecha: string) {
  const inicioDia = new Date(`${fecha}T00:00:00-03:00`).getTime();
  const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const intervalos: { inicio: Date; fin: Date; duracion: number }[] = [];
  for (const b of bloques) {
    if (!Number.isInteger(b.duracionTurnoMinutos) || b.duracionTurnoMinutos <= 0) continue;
    for (const desplazamiento of [-1, 0]) {
      if (b.diaSemana !== (diaSemana + desplazamiento + 7) % 7) continue;
      const inicio = inicioDia + (desplazamiento * DIA + minutos(b.horaInicio)) * MINUTO;
      const fin = inicioDia + (desplazamiento * DIA + minutos(b.horaFin) + (b.terminaDiaSiguiente ? DIA : 0)) * MINUTO;
      for (let t = inicio; t + b.duracionTurnoMinutos * MINUTO <= fin; t += b.duracionTurnoMinutos * MINUTO) {
        if (t >= inicioDia && t < inicioDia + DIA * MINUTO) intervalos.push({ inicio: new Date(t), fin: new Date(t + b.duracionTurnoMinutos * MINUTO), duracion: b.duracionTurnoMinutos });
      }
    }
  }
  return intervalos.sort((a, b) => +a.inicio - +b.inicio);
}
