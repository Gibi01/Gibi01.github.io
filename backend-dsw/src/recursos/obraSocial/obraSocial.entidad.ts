import { BeforeCreate, BeforeUpdate } from '@mikro-orm/core';
import { claveNombre, nombrePresentacion } from '../../shared/nombreCatalogo.js';
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class ObraSocial {
  @PrimaryKey()
  id!: number;

  @Property()
  nombre!: string;


  @Property({ nullable: true, unique: true, hidden: true, length: 191 })
  nombreNormalizado?: string;

  @BeforeCreate()
  @BeforeUpdate()
  normalizarNombre() {
    this.nombre = nombrePresentacion(this.nombre);
    this.nombreNormalizado = claveNombre(this.nombre);
  }
}
