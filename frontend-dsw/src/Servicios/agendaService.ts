// src/Servicios/agendaService.ts
import { api, type ApiResponse } from "./api";

export interface NuevaAgenda {
  doctorId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  duracionTurnoMinutos: number;
  terminaDiaSiguiente?: boolean;
}

export interface Agenda {
  id: number;
  doctor: { matricula: number; nombre: string; apellido: string };
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  duracionTurnoMinutos: number;
  terminaDiaSiguiente?: boolean;
}

export type BloqueAgenda = Omit<NuevaAgenda, 'doctorId'>;
export interface SemanaAgenda {
  version: number; activo: boolean; bloques: Agenda[];
  sinDuracion: { id: number; fechaHoraTurno: string }[];
}
export interface ImpactoAgenda {
  version: number; token: string;
  excepciones: { id: number; fechaHoraTurno: string; duracionTurnoMinutos: number }[];
}
export async function obtenerSemana(doctorId: number) {
  return (await api.get<ApiResponse<SemanaAgenda>>(`/agendas/semanal/${doctorId}`)).data;
}
export async function revisarSemana(doctorId: number, version: number, bloques: BloqueAgenda[]) {
  return (await api.post<ApiResponse<ImpactoAgenda>>(`/agendas/semanal/${doctorId}/previsualizar`, { version, bloques })).data;
}
export async function guardarSemana(doctorId: number, version: number, bloques: BloqueAgenda[], token: string, aceptarExcepciones: boolean) {
  return api.put(`/agendas/semanal/${doctorId}`, { version, bloques, token, aceptarExcepciones });
}
export async function completarDuracion(doctorId: number, turnoId: number, duracionTurnoMinutos: number) {
  return api.patch(`/agendas/semanal/${doctorId}/duraciones/${turnoId}`, { duracionTurnoMinutos });
}

export async function crearAgenda(datos: NuevaAgenda): Promise<Agenda> {
  const respuesta = await api.post<ApiResponse<Agenda>>("/agendas", datos);
  return respuesta.data;
}

export async function getAgendas(doctorId?: number): Promise<Agenda[]> {
  const query = doctorId ? `?doctorId=${doctorId}` : "";
  const respuesta = await api.get<ApiResponse<Agenda[]>>(`/agendas${query}`);
  return respuesta.data;
}

export async function actualizarAgenda(id: number, datos: Partial<NuevaAgenda>): Promise<Agenda> {
  const respuesta = await api.patch<ApiResponse<Agenda>>(`/agendas/${id}`, datos);
  return respuesta.data;
}

export async function eliminarAgenda(id: number): Promise<void> {
  await api.delete(`/agendas/${id}`);
}
