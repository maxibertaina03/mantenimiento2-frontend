import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Preparar un comprobante para subirlo.
 *
 * Un PDF va tal cual: recomprimirlo no ahorra nada y arriesga romperlo. Una
 * foto se achica en el navegador, con MAS resolucion que las fotos de equipos,
 * porque una foto de una bomba se mira y una de un remito se lee.
 */
const comprimirMock = vi.fn();
vi.mock('./comprimirImagen', () => ({
  comprimirImagen: (...args: unknown[]) => comprimirMock(...args),
}));

const { EXTENSIONES, esAceptado, leerComprobante } = await import('./leerComprobante');

const archivo = (nombre: string, bytes = 100) =>
  new File([new Uint8Array(bytes)], nombre, {
    type: nombre.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
  });

beforeEach(() => {
  comprimirMock.mockReset();
  comprimirMock.mockResolvedValue({
    base64: 'AAAA',
    nombreArchivo: 'remito.jpg',
    bytesOriginales: 3_000_000,
    bytesFinales: 400_000,
  });
});

describe('esAceptado', () => {
  it.each(['remito.pdf', 'foto.jpg', 'foto.JPEG', 'escaneo.png', 'x.webp'])(
    'acepta %s',
    (nombre) => {
      expect(esAceptado(archivo(nombre))).toBe(true);
    },
  );

  it.each(['remito.docx', 'planilla.xlsx', 'foto.heic', 'archivo.zip', 'sinextension'])(
    'REGRESION: rechaza %s',
    (nombre) => {
      // Se subirian sin problema y despues nadie los puede abrir. El .heic de
      // los iPhone es el caso mas facil de encontrarse.
      expect(esAceptado(archivo(nombre))).toBe(false);
    },
  );

  it('la lista de aceptados es la que se le muestra al usuario', () => {
    expect(EXTENSIONES).toContain('pdf');
    expect(EXTENSIONES).toContain('jpg');
    expect(EXTENSIONES).not.toContain('heic');
  });
});

describe('leerComprobante', () => {
  it('REGRESION: un PDF no pasa por el compresor de imagenes', async () => {
    // Pasarlo por el canvas lo convertiria en una imagen: se perderia el texto
    // seleccionable y, en un PDF de varias hojas, todas menos la primera.
    const resultado = await leerComprobante(archivo('remito.pdf', 500));

    expect(comprimirMock).not.toHaveBeenCalled();
    expect(resultado.esPdf).toBe(true);
    expect(resultado.nombreArchivo).toBe('remito.pdf');
    expect(resultado.archivoBase64).not.toContain('data:');
  });

  it('REGRESION: una foto se achica, y con mas resolucion que las de equipos', async () => {
    // A 1600 px un remito A4 fotografiado de lejos queda con los numeros al
    // borde de lo legible, y el numero es justamente lo que se va a comparar.
    await leerComprobante(archivo('remito.jpg', 3_000_000));

    const opciones = comprimirMock.mock.calls[0][1] as { lado: number; calidad: number };
    expect(opciones.lado).toBeGreaterThan(1600);
    expect(opciones.calidad).toBeGreaterThanOrEqual(0.8);
  });

  it('de la foto informa el peso ya achicado, no el original', async () => {
    // Es el que cuenta contra el tope de 10 MB, y el que se le muestra.
    const resultado = await leerComprobante(archivo('remito.jpg', 3_000_000));
    expect(resultado.bytes).toBe(400_000);
    expect(resultado.esPdf).toBe(false);
  });
});
