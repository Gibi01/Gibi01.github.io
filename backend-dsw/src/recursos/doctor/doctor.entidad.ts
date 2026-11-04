import {
  OptionalProps,
  Collection,
  Entity,
  ManyToMany,
  OneToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Especialidad } from '../especialidad/especialidad.entidad.js';
import { Usuario } from '../usuarios/usuario.entidad.js';

@Entity()
export class Doctor {
  [OptionalProps]?: 'versionAgenda';

  @PrimaryKey()
  matricula!: number;

  // el doctor tambien es un Usuario (tiene su propia cuenta para loguearse). nombre,
  // apellido, email, foto, direccion, etc quedan solo en Usuario para no duplicar
  @OneToOne(() => Usuario, { owner: true, unique: true })
  usuario!: Usuario;

  @ManyToMany(() => Especialidad, especialidad => especialidad.doctores, {
    owner: true,
  })
  especialidades = new Collection<Especialidad>(this);

  // baja logica, si esta en false no se borra nada pero deja de aparecer en listados,
  // fichas y disponibilidad para el paciente
  @Property()
  activo: boolean = true;

  @Property({ default: 0 })
  versionAgenda: number = 0;
}
