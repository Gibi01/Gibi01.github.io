import { BeforeCreate, BeforeUpdate } from '@mikro-orm/core';
import { claveNombre, nombrePresentacion } from '../../shared/nombreCatalogo.js';
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class MotivoCancelacion {
  @PrimaryKey()
  id!: number;

  @Property()
  descripcion!: string;

  @Property({ nullable: true, unique: true, hidden: true, length: 191 })
  nombreNormalizado?: string;

  @BeforeCreate()
  @BeforeUpdate()
  normalizarNombre() {
    this.descripcion = nombrePresentacion(this.descripcion);
    this.nombreNormalizado = claveNombre(this.descripcion);
  }
}
