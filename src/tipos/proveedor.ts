export interface Proveedor {
  id: string;
  nombre: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  notas: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearProveedorInput {
  nombre: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  notas?: string;
}

/**
 * `null` en un campo lo vacía; `undefined` lo deja como estaba.
 *
 * La distinción importa al corregir el contacto: borrar un teléfono mal
 * cargado no es lo mismo que no tocarlo.
 */
export type ActualizarProveedorInput = {
  [K in keyof CrearProveedorInput]?: CrearProveedorInput[K] | null;
};
