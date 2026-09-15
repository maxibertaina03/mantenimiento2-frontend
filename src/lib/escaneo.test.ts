import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { leerEscaneo, useEscaneoSuelto } from './escaneo';

/**
 * La pistola de códigos es un teclado, no una cámara: escanear un QR es
 * tipear la dirección entera muy rápido y apretar Enter. Estos tests fijan qué
 * texto se reconoce como escaneo y cuál no.
 */

const ID = '1e035e68-e43f-4776-9706-3e64fcd3fe33';
const BASE = 'https://mantenimiento2-frontend.vercel.app';

describe('leerEscaneo', () => {
  it('reconoce la etiqueta de un material', () => {
    expect(leerEscaneo(`${BASE}/materiales/${ID}`)).toEqual({ clase: 'material', id: ID });
  });

  it('reconoce la etiqueta de un equipo', () => {
    expect(leerEscaneo(`${BASE}/equipos?equipo=${ID}`)).toEqual({ clase: 'equipo', id: ID });
  });

  it('REGRESION: lee igual un escaneo con el teclado de la pistola mal configurado', () => {
    // Esto es literalmente lo que escribio la pistola en produccion, con el mapa
    // de teclado en ingles y Windows en español: los dos puntos salieron Ñ, las
    // barras guiones y los guiones apostrofes. Las letras y numeros salen
    // intactos, asi que el id sobrevive y se puede leer igual.
    const mal = "httpsÑ--mantenimiento2'frontend.vercel.app-materiales-1e035e68'e43f'4776'9706'3e64fcd3fe33";

    expect(leerEscaneo(mal)).toEqual({ clase: 'material', id: ID });
  });

  it('un id pelado no dice de que modulo es', () => {
    // Decide quien lo recibe: en el buscador de materiales, es un material.
    expect(leerEscaneo(ID)).toEqual({ clase: 'sin-dato', id: ID });
  });

  it('normaliza el id a minusculas', () => {
    expect(leerEscaneo(`${BASE}/materiales/${ID.toUpperCase()}`)?.id).toBe(ID);
  });

  it.each([
    ['un nombre de material', 'Reten 40x72x10'],
    ['un nombre que parece codigo', 'Abrazadera inox 26-28 (1")'],
    ['texto vacio', ''],
    ['una direccion sin id', `${BASE}/materiales`],
    ['numeros sueltos', '12345678'],
    ['un id incompleto', '1e035e68-e43f-4776-9706'],
  ])('REGRESION: no confunde %s con un escaneo', (_caso, texto) => {
    // Si esto fallara, escribir a mano en el buscador dispararia escaneos.
    expect(leerEscaneo(texto)).toBeNull();
  });
});

describe('useEscaneoSuelto', () => {
  /** Teclea el texto como lo hace la pistola: una tecla por vez y un Enter. */
  const disparar = (texto: string, destino: EventTarget = document.body) => {
    for (const letra of texto) {
      destino.dispatchEvent(new KeyboardEvent('keydown', { key: letra, bubbles: true }));
    }
    destino.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  };

  it('levanta el escaneo cuando el cursor no esta en ningun campo', () => {
    const alEscanear = vi.fn();
    renderHook(() => useEscaneoSuelto(true, alEscanear));

    disparar(`${BASE}/materiales/${ID}`);

    expect(alEscanear).toHaveBeenCalledWith({ clase: 'material', id: ID });
  });

  it('REGRESION: no se mete cuando el cursor esta en un campo de texto', () => {
    // Ahi el escaneo entra como texto y lo resuelve el campo. Si ademas lo
    // levantara este enganche, el material entraria dos veces.
    const alEscanear = vi.fn();
    renderHook(() => useEscaneoSuelto(true, alEscanear));

    const campo = document.createElement('input');
    document.body.append(campo);
    campo.focus();
    disparar(`${BASE}/materiales/${ID}`, campo);

    expect(alEscanear).not.toHaveBeenCalled();
    campo.remove();
  });

  it('REGRESION: frena el Enter con el que termina el escaneo', () => {
    // Sin esto, el Enter aprieta el boton que tuviera el foco: escanear con el
    // cursor en «Quitar» borraria un renglon.
    renderHook(() => useEscaneoSuelto(true, vi.fn()));

    for (const letra of `${BASE}/materiales/${ID}`) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: letra, bubbles: true }));
    }
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.body.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(true);
  });

  it('escribir despacio a mano no dispara nada', () => {
    const alEscanear = vi.fn();
    renderHook(() => useEscaneoSuelto(true, alEscanear));

    disparar('reten 40');

    expect(alEscanear).not.toHaveBeenCalled();
  });

  it('apagado no escucha', () => {
    const alEscanear = vi.fn();
    renderHook(() => useEscaneoSuelto(false, alEscanear));

    disparar(`${BASE}/materiales/${ID}`);

    expect(alEscanear).not.toHaveBeenCalled();
  });
});
