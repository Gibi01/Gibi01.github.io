import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { Turno } from './turno.entidad.js';

export type TipoNotificacionTurno = 'recordatorio' | 'asistido' | 'no_asistido' | 'cancelado';
export type EstadoNotificacionTurno = 'pendiente' | 'procesando' | 'enviado' | 'fallido' | 'omitido';

@Entity()
@Unique({ properties: ['turno', 'tipo'] })
export class NotificacionTurno {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Turno)
  turno!: Turno;

  @Enum({ items: () => ['recordatorio', 'asistido', 'no_asistido', 'cancelado'] })
  tipo!: TipoNotificacionTurno;

  @Enum({ items: () => ['pendiente', 'procesando', 'enviado', 'fallido', 'omitido'] })
  estado: EstadoNotificacionTurno = 'pendiente';

  @Property()
  destinatario!: string;

  @Property()
  asunto!: string;

  @Property({ columnType: 'text' })
  texto!: string;

  @Property()
  creadaEn: Date = new Date();

  @Property()
  proximoIntentoEn: Date = new Date();

  @Property()
  intentos = 0;

  @Property({ nullable: true })
  enviadaEn?: Date;

  // Conserva la columna y el historial del proveedor anterior.
  @Property({ nullable: true, fieldName: 'resend_id' })
  proveedorId?: string;

  @Property({ nullable: true, columnType: 'text' })
  ultimoError?: string;
}
