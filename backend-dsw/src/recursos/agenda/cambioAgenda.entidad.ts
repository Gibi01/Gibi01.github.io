import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { Doctor } from '../doctor/doctor.entidad.js';

@Entity()
export class CambioAgenda {
  @PrimaryKey() id!: number;
  @ManyToOne(() => Doctor, { deleteRule: 'cascade' }) doctor!: Doctor;
  @Property() usuarioId!: number;
  @Property() version!: number;
  @Property() fecha: Date = new Date();
  @Property({ type: 'json' }) bloques!: unknown[];
}
