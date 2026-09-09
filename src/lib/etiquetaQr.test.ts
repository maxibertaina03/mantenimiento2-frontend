import { describe, expect, it } from 'vitest';
import { qrComoImagen, urlDeLaFicha } from './etiquetaQr';

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
