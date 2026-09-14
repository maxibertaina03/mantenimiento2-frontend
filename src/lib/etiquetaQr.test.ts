import { describe, expect, it } from 'vitest';
import {
  FORMATOS,
  esDireccionLocal,
  etiquetasPorHoja,
  qrComoImagen,
  urlDeLaFicha,
} from './etiquetaQr';

/**
 * Las etiquetas que se pegan en las maquinas.
 *
 * Lo que importa es que el QR lleve a la ficha correcta: una etiqueta con el
 * enlace mal armado se descubre recien cuando alguien la escanea abajo, en la
 * planta, con la etiqueta ya pegada.
 */
describe('urlDeLaFicha', () => {
  it('apunta a la ficha del equipo', () => {
    expect(urlDeLaFicha('eq-1', 'https://mantenimiento.lacteoslastres.com.ar')).toBe(
      'https://mantenimiento.lacteoslastres.com.ar/equipos?equipo=eq-1',
    );
  });

  it('REGRESION: usa el id y no el nombre', () => {
    // El nombre cambia (se corrige un typo, se renombra la maquina) y la
    // etiqueta pegada dejaria de encontrarla. El id no cambia nunca.
    const url = urlDeLaFicha('550e8400-e29b-41d4-a716-446655440000', 'https://x.com');
    expect(url).toContain('550e8400-e29b-41d4-a716-446655440000');
  });

  it('no arrastra una barra de mas si el origen termina en barra', () => {
    // Doble barra en la URL rompe el enrutador del navegador.
    expect(urlDeLaFicha('eq-1', 'https://x.com')).not.toContain('//equipos');
  });
});

describe('qrComoImagen', () => {
  it('devuelve una imagen PNG lista para meter en el HTML', async () => {
    // Va como data: adentro del propio HTML porque la ventana de impresion no
    // puede depender de pedirle nada al servidor.
    const img = await qrComoImagen('https://x.com/equipos?equipo=eq-1');
    expect(img.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('el codigo mas largo sigue generandose', async () => {
    // Un id de 36 caracteres mas el dominio: si no entrara, la etiqueta saldria
    // vacia sin avisar.
    const largo = urlDeLaFicha('550e8400-e29b-41d4-a716-446655440000', 'https://mantenimiento.lacteoslastres.com.ar');
    const img = await qrComoImagen(largo);
    expect(img.length).toBeGreaterThan(500);
  });
});


describe('esDireccionLocal', () => {
  // Una etiqueta impresa con la direccion local es papel tirado: en el celular
  // esa direccion no es ningun lado, y no se descubre hasta tener las 326
  // etiquetas pegadas en la planta.
  it.each([
    'http://localhost:5173',
    'http://localhost',
    'http://127.0.0.1:5173',
    'http://0.0.0.0:3000',
    'http://[::1]:5173',
  ])('reconoce %s como local', (url) => {
    expect(esDireccionLocal(url)).toBe(true);
  });

  it.each([
    'https://mantenimiento.lacteoslastres.com.ar',
    'https://mantenimiento2-frontend.vercel.app',
  ])('%s si sirve', (url) => {
    expect(esDireccionLocal(url)).toBe(false);
  });

  it('REGRESION: un dominio que solo EMPIEZA con localhost no es local', () => {
    // "localhost.miempresa.com" es un dominio de verdad y bloquearlo dejaria
    // sin poder imprimir a quien lo use.
    expect(esDireccionLocal('https://localhost.miempresa.com')).toBe(false);
  });
});

describe('urlDeLaFichaMaterial', () => {
  it('apunta a la ficha del material', async () => {
    const { urlDeLaFichaMaterial } = await import('./etiquetaQr');
    expect(urlDeLaFichaMaterial('mat-1', 'https://x.com')).toBe('https://x.com/materiales/mat-1');
  });

  it('no arrastra una barra de mas si el origen termina en barra', async () => {
    const { urlDeLaFichaMaterial } = await import('./etiquetaQr');
    expect(urlDeLaFichaMaterial('mat-1', 'https://x.com/')).toBe('https://x.com/materiales/mat-1');
  });
});

describe('armarEtiquetasMateriales', () => {
  const material = (over = {}) =>
    ({
      id: 'mat-1',
      nombre: 'Aceite hidráulico ISO 68',
      categoriaNombre: 'Lubricantes',
      unidadNombre: 'Litro',
      stockActual: 12,
      ...over,
    }) as never;

  it('la etiqueta lleva nombre, categoria y unidad', async () => {
    const { armarEtiquetasMateriales } = await import('./etiquetaQr');
    const [e] = await armarEtiquetasMateriales([material()], 'https://x.com');

    expect(e.titulo).toBe('Aceite hidráulico ISO 68');
    expect(e.subtitulo).toBe('Lubricantes');
    expect(e.pie).toBe('Litro');
  });

  it('REGRESION: NO lleva la cantidad impresa', async () => {
    // El stock cambia todos los dias: una etiqueta que dice "quedan 12" miente
    // al dia siguiente, y una etiqueta que miente es peor que ninguna.
    const { armarEtiquetasMateriales } = await import('./etiquetaQr');
    const [e] = await armarEtiquetasMateriales([material({ stockActual: 12 })], 'https://x.com');

    const texto = [e.titulo, e.subtitulo, e.pie].join(' ');
    expect(texto).not.toContain('12');
  });

  it('REGRESION: no imprime la unidad cuando dice "Unidad"', async () => {
    // 368 de los 373 materiales dicen eso. Imprimirlo gasta el renglon que le
    // falta al nombre para repetir lo que ya se da por sentado.
    const { armarEtiquetasMateriales } = await import('./etiquetaQr');
    const [e] = await armarEtiquetasMateriales(
      [material({ unidadNombre: 'Unidad' })],
      'https://x.com',
    );
    expect(e.pie).toBeNull();
  });

  it('pero si la imprime cuando aporta algo', async () => {
    const { armarEtiquetasMateriales } = await import('./etiquetaQr');
    const [e] = await armarEtiquetasMateriales([material({ unidadNombre: 'Metro' })], 'https://x.com');
    expect(e.pie).toBe('Metro');
  });

  it('un material sin categoria no deja el renglon en blanco raro', async () => {
    const { armarEtiquetasMateriales } = await import('./etiquetaQr');
    const [e] = await armarEtiquetasMateriales(
      [material({ categoriaNombre: null, unidadNombre: null })],
      'https://x.com',
    );
    expect(e.subtitulo).toBeNull();
    expect(e.pie).toBeNull();
  });

  it('el QR apunta a la ficha, no al listado', async () => {
    // Es lo unico que no se puede corregir despues de pegar la etiqueta.
    const { armarEtiquetasMateriales, qrComoImagen, urlDeLaFichaMaterial } = await import(
      './etiquetaQr'
    );
    const [e] = await armarEtiquetasMateriales([material()], 'https://x.com');
    const esperado = await qrComoImagen(urlDeLaFichaMaterial('mat-1', 'https://x.com'), 320, 'M');
    expect(e.qr).toBe(esperado);
  });
});

/**
 * Las medidas de la etiqueta.
 *
 * Importan de verdad: se imprimen de a doscientas y se pegan en cajas de
 * 85 x 30 mm. Un milimetro de mas y sobresalen; un QR chico de mas y el celular
 * no lo lee, cosa que se descubre con las etiquetas ya pegadas.
 */
describe('FORMATOS', () => {
  it('la etiqueta de material entra en una caja de 85 x 30 mm', () => {
    const f = FORMATOS.material;
    // Con menos de dos milimetros de aire por lado no se pega derecha.
    expect(85 - f.ancho).toBeGreaterThanOrEqual(4);
    expect(30 - f.alto).toBeGreaterThanOrEqual(2);
  });

  it('el QR entra en el alto de la etiqueta con su margen', () => {
    const f = FORMATOS.material;
    expect(f.qr).toBeLessThanOrEqual(f.alto - 5);
  });

  it('REGRESION: el QR no baja del tamano en que deja de leerse', () => {
    // Con correccion M, la URL de una ficha da 41 modulos de lado. Un celular
    // lee comodo a partir de 0,5 mm por modulo y la pelea por debajo de 0,4.
    const mmPorModulo = (FORMATOS.material.qr - 2) / 41;
    expect(mmPorModulo).toBeGreaterThan(0.45);
  });

  it('las dos columnas entran en un A4 con margen de 10 mm', () => {
    for (const f of Object.values(FORMATOS)) {
      expect(f.columnas * f.ancho + (f.columnas - 1) * 4).toBeLessThanOrEqual(190);
    }
  });

  it('el texto del material quedo mas grande que el de las maquinas', () => {
    expect(FORMATOS.material.cuerpoNombre).toBeGreaterThan(FORMATOS.equipo.cuerpoNombre);
    expect(FORMATOS.material.cuerpoSub).toBeGreaterThan(FORMATOS.equipo.cuerpoSub);
  });

  it('la etiqueta de las maquinas no cambio', () => {
    // Solo se pidio achicar la de materiales.
    expect(FORMATOS.equipo).toMatchObject({ ancho: 60, alto: 34, qr: 26, columnas: 3 });
  });
});

describe('etiquetasPorHoja', () => {
  it('REGRESION: se calcula, no se escribe a mano', () => {
    // La pantalla decia "24 por hoja" y entraban 21.
    expect(etiquetasPorHoja(FORMATOS.equipo)).toBe(21);
    expect(etiquetasPorHoja(FORMATOS.material)).toBe(18);
  });

  it('ninguna fila se pasa del alto util de la hoja', () => {
    for (const f of Object.values(FORMATOS)) {
      const filas = etiquetasPorHoja(f) / f.columnas;
      expect(filas * (f.alto + 4) - 4).toBeLessThanOrEqual(297 - 20);
    }
  });
});
