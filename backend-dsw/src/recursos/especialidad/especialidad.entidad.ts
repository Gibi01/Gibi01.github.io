import { BeforeCreate, BeforeUpdate } from '@mikro-orm/core';
import { claveNombre, nombrePresentacion } from '../../shared/nombreCatalogo.js';
import {
  Collection,
  OptionalProps,
  Entity,
  ManyToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Doctor } from '../doctor/doctor.entidad.js';

@Entity()
export class Especialidad {

  [OptionalProps]?: 'icono';

  @PrimaryKey()
  idEspecialidad!: number;

  @Property()
  descripcionEsp!: string;

  @Property({ default: 'medicina', length: 32 })
  icono: string = 'medicina';

  @ManyToMany(() => Doctor, doctor => doctor.especialidades)
  doctores = new Collection<Doctor>(this);

  @Property({ nullable: true, unique: true, hidden: true, length: 191 })
  nombreNormalizado?: string;

  @BeforeCreate()
  @BeforeUpdate()
  normalizarNombre() {
    this.descripcionEsp = nombrePresentacion(this.descripcionEsp);
    this.nombreNormalizado = claveNombre(this.descripcionEsp);
  }
}
