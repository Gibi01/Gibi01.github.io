export const claveNombreCatalogo = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-AR');
export const primeraMayuscula = (valor: string) => valor.replace(/\p{L}/u, letra => letra.toLocaleUpperCase('es-AR'));
export const nombreCatalogo = (valor: string) => primeraMayuscula(valor.normalize('NFC').trim().replace(/\s+/g, ' '));
