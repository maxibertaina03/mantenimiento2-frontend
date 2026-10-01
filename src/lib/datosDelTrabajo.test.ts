import { describe, expect, it } from 'vitest';
import { DATOS_DEL_TRABAJO_VACIOS, faltaElProveedor, paraEnviar } from './datosDelTrabajo';

describe('datos del trabajo (quién lo hizo, costo, horas)', () => {
  it('un trabajo propio no pide proveedor', () => {
    expect(faltaElProveedor(DATOS_DEL_TRABAJO_VACIOS)).toBe(false);
  });

  it('un trabajo externo sin proveedor no se puede guardar', () => {
    expect(faltaElProveedor({ ...DATOS_DEL_TRABAJO_VACIOS, ejecutor: 'EXTERNO' })).toBe(true);
    expect(
      faltaElProveedor({ ...DATOS_DEL_TRABAJO_VACIOS, ejecutor: 'EXTERNO', proveedorId: 'p-1' }),
    ).toBe(false);
  });

  it('manda el proveedor, el costo y las horas cuando fue externo', () => {
    expect(
      paraEnviar({ ejecutor: 'EXTERNO', proveedorId: 'p-1', costo: 85000, horas: 6 }),
    ).toEqual({ ejecutor: 'EXTERNO', proveedorId: 'p-1', costoManoObra: 85000, horasParada: 6 });
  });

  it('REGRESION: si se eligió un proveedor y después se volvió a «propio», no lo manda', () => {
    expect(
      paraEnviar({ ejecutor: 'INTERNO', proveedorId: 'p-1', costo: undefined, horas: undefined })
        .proveedorId,
    ).toBeUndefined();
  });
});
