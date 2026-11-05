import { Entity, PrimaryKey, Property, ManyToOne, OptionalProps } from '@mikro-orm/core';
import { Doctor } from '../doctor/doctor.entidad.js';

// bloque de disponibilidad semanal recurrente de un doctor. puede tener varios bloques
// (ej lunes manana y lunes tarde con distinta duracion de turno)
@Entity()
export class Agenda {
  [OptionalProps]?: 'terminaDiaSiguiente';
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Doctor)
  doctor!: Doctor;

  @Property()
  diaSemana!: number; // 0 = domingo ... 6 = sábado

  @Property()
  horaInicio!: string; // "HH:MM"

  @Property()
  horaFin!: string; // "HH:MM"

  @Property()
  duracionTurnoMinutos!: number;

  @Property({ default: false })
  terminaDiaSiguiente: boolean = false;
}
