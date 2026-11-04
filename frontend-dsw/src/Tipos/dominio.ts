// Interfaces del modelo de dominio. Reflejan el shape real que devuelve el backend
// (ver backend-dsw/src/recursos/*/*.entidad.ts), no un mock aparte.

export interface Especialidad {
  idEspecialidad: number;
  descripcionEsp: string;
  icono?: string;
}

export interface Doctor {
  matricula: number;
  nombre: string;
  apellido: string;
  email?: string;
  foto?: string | null;
  especialidades?: Especialidad[];
  activo?: boolean;
}

export interface ObraSocial {
  id: number;
  nombre: string;
}

export interface MotivoCancelacion {
  id: number;
  descripcion: string;
}

export interface RegistroUsuarioForm {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  foto?: string | null;
}

export interface PerfilUsuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  dni?: string;
  foto?: string | null;
  obraSocial?: string;
  direccion?: string;
  telefonoCelular?: string;
}

export type EstadoTurno = "pendiente" | "cancelado" | "asistido" | "no_asistido";

export interface Turno {
  id: number;
  usuarioId: number;
  doctor: Doctor;
  obraSocial: ObraSocial | null;
  fechaHoraEmision: string;
  fechaHoraTurno: string;
  duracionTurnoMinutos?: number | null;
  estado: EstadoTurno;
  fechaHoraCancelacion: string | null;
  motivoCancelacion: string | null;
  motivoCancelacionPreestablecido: MotivoCancelacion | null;
}

export interface PacienteDeTurno {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  dni: string | null;
  telefonoCelular: string | null;
}

export interface TurnoParaDoctor extends Turno {
  paciente: PacienteDeTurno;
}

export interface SlotEspecialidad {
  fechaHoraTurno: string;
  doctor: Doctor;
}

export const estadosTurno: Record<EstadoTurno, string> = { pendiente: 'Pendiente', cancelado: 'Cancelado', asistido: 'Asistido', no_asistido: 'No asistido' };
