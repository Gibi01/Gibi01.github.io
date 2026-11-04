import { api, type ApiResponse } from './api';
import type { Especialidad, TurnoParaDoctor } from '../Tipos/dominio';

export interface UsuarioListado {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  activo: boolean;
  fechaAlta: string | null;
}

export async function getUsuariosListado(): Promise<UsuarioListado[]> {
  return (await api.get<ApiResponse<UsuarioListado[]>>('/usuarios/listado')).data;
}

export interface UsuarioDetalleAdmin extends UsuarioListado {
  dni: string | null;
  direccion: string | null;
  telefonoCelular: string | null;
  doctor: { matricula: number; activo: boolean; especialidades: Especialidad[] } | null;
}
export const getPerfilAdmin = async (id: string) => (await api.get<ApiResponse<UsuarioDetalleAdmin>>(`/usuarios/${id}/perfil-admin`)).data;
export const getHistorialAdmin = async (id: number, query: URLSearchParams) => (await api.get<ApiResponse<{ total: number; pagina: number; turnos: TurnoParaDoctor[] }>>(`/usuarios/${id}/turnos-admin?${query}`)).data;
