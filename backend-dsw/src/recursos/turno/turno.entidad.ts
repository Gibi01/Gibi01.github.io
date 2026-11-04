import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { Usuario } from '../usuarios/usuario.entidad.js';
import { Doctor } from '../doctor/doctor.entidad.js';
import { ObraSocial } from '../obraSocial/obraSocial.entidad.js';
import { MotivoCancelacion } from '../motivoCancelacion/motivoCancelacion.entidad.js';

// pendiente: recien creado. cancelado: lo cancelo el paciente. asistido: se presento y lo
// confirma el doctor. no_asistido: no aparecio ni cancelo (lo pone el doctor a mano, o el
// sistema solo a las 12hs de pasada la fecha del turno)
export type EstadoTurno = 'pendiente' | 'cancelado' | 'asistido' | 'no_asistido';

@Entity()
export class Turno {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Usuario)
  usuario!: Usuario;

  @ManyToOne(() => Doctor)
  doctor!: Doctor;

  // obra social elegida por el paciente para este turno puntual (de las que tiene asociadas)
  @ManyToOne(() => ObraSocial, { nullable: true })
  obraSocial?: ObraSocial;

  @Property()
  fechaHoraEmision!: Date;

  @Property()
  fechaHoraTurno!: Date;

  @Property({ nullable: true })
  duracionTurnoMinutos?: number;

  @Property()
  estado: EstadoTurno = 'pendiente';

  @Property({ nullable: true })
  fechaHoraCancelacion?: Date;

  @Property({ nullable: true })
  motivoCancelacion?: string;

  // motivo elegido de la lista que carga el admin, como mucho uno (a diferencia del texto
  // libre de arriba, este es opcional y de seleccion unica)
  @ManyToOne(() => MotivoCancelacion, { nullable: true })
  motivoCancelacionPreestablecido?: MotivoCancelacion;
}
