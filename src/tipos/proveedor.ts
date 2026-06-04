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

export type ActualizarProveedorInput = Partial<CrearProveedorInput>;
