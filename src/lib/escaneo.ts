import { useEffect, useRef } from 'react';

/**
 * Lo que deja escrito la pistola de códigos, traducido a un id de ficha.
 *
 * La pistola no es una cámara: es un teclado. Escanear un QR es exactamente lo
 * mismo que si alguien tecleara la dirección entera muy rápido y apretara Enter
 * al final. Así que lo que llega al sistema es texto en un campo, y hay que
 * reconocerlo antes de salir a buscar un material que se llame
 * «https://mantenimiento2-frontend.vercel.app/materiales/1e03…».
 */

/**
 * El id: 8-4-4-4-12 en hexadecimal, con cualquier cosa (o nada) separando los
 * grupos.
 *
 * Los separadores van flojos a propósito. La pistola escribe con un mapa de
 * teclado, y cuando ese mapa no coincide con el de Windows salen cambiados los
 * SÍMBOLOS —`:` como `Ñ`, `/` como `-`, `-` como `'`— mientras que las letras y
 * los números salen intactos. Como el id es solo letras y números, sobrevive
 * entero aunque la pistola esté mal configurada. Aceptarlo de las dos formas no
 * cuesta nada y evita que el día que una pistola se resetee no ande nada.
 */
const ID =
  /([0-9a-f]{8})[^0-9a-f]?([0-9a-f]{4})[^0-9a-f]?([0-9a-f]{4})[^0-9a-f]?([0-9a-f]{4})[^0-9a-f]?([0-9a-f]{12})/i;

/**
 * De qué ficha es el código.
 *
 * `sin-dato` es un id pelado, sin dirección alrededor: no se puede saber de qué
 * módulo es, así que decide quien lo recibe.
 */
export type ClaseEscaneo = 'material' | 'equipo' | 'equipo-it' | 'sin-dato';

export interface Escaneo {
  clase: ClaseEscaneo;
  id: string;
}

/** Devuelve el escaneo si el texto es uno, o `null` si es texto escrito a mano. */
export function leerEscaneo(texto: string): Escaneo | null {
  const encontrado = ID.exec(texto);
  if (!encontrado) return null;

  const [, a, b, c, d, e] = encontrado;
  const id = `${a}-${b}-${c}-${d}-${e}`.toLowerCase();

  // Las palabras de la dirección llegan intactas aunque los símbolos no, así
  // que sirven para distinguir la etiqueta de un material de la de un equipo.
  if (/material/i.test(texto)) return { clase: 'material', id };
  // ANTES que `equipo`, y no es un detalle: la dirección de un equipo de
  // informática es /equipos-it, que contiene la palabra "equipo". Al revés,
  // toda etiqueta de una PC se leería como si fuera de una máquina de planta y
  // abriría una ficha que no existe.
  //
  // El guion del medio va flojo por lo mismo que los del id: con el mapa de
  // teclado cambiado sale apostrofe, y `equipos'it` tiene que reconocerse
  // igual. Lo que sigue a "it" no puede ser una letra ni un numero, para no
  // confundirse con una palabra que empiece igual.
  if (/equipos?[^a-z0-9]?it(?![a-z0-9])/i.test(texto)) return { clase: 'equipo-it', id };
  if (/equipo/i.test(texto)) return { clase: 'equipo', id };
  return { clase: 'sin-dato', id };
}

/**
 * Escucha los escaneos que caen FUERA de un campo de texto.
 *
 * Hace falta porque el escaneo va a parar a donde esté el cursor, y el cursor
 * puede estar en un botón —el «Quitar» de un renglón, por ejemplo— o en ningún
 * lado. Sin esto, además, el Enter con el que la pistola termina cada escaneo
 * apretaría el botón que estuviera enfocado.
 *
 * Cuando el cursor SÍ está en un campo de texto, este enganche no hace nada: el
 * escaneo entra como texto y lo resuelve el campo, que es el caso normal.
 */
export function useEscaneoSuelto(activo: boolean, alEscanear: (escaneo: Escaneo) => void): void {
  // En una ref para no re-suscribir el enganche en cada render.
  const avisar = useRef(alEscanear);
  avisar.current = alEscanear;

  useEffect(() => {
    if (!activo) return;

    let acumulado = '';
    let ultimaTecla = 0;
    let ultimoEscaneo = 0;

    const escribiendoEnUnCampo = () => {
      const donde = document.activeElement;
      return (
        donde instanceof HTMLInputElement ||
        donde instanceof HTMLTextAreaElement ||
        donde instanceof HTMLSelectElement ||
        (donde instanceof HTMLElement && donde.isContentEditable)
      );
    };

    const alaTecla = (ev: KeyboardEvent) => {
      if (escribiendoEnUnCampo()) {
        acumulado = '';
        return;
      }

      const ahora = Date.now();

      if (ev.key === 'Enter') {
        // El Enter del final del escaneo. Si no se lo frena, activa el botón
        // que tenga el foco.
        if (ahora - ultimoEscaneo < 300) ev.preventDefault();
        acumulado = '';
        return;
      }

      // Una pausa corta ya corta la ráfaga: lo de antes era otra cosa.
      if (ahora - ultimaTecla > 200) acumulado = '';
      ultimaTecla = ahora;

      if (ev.key.length !== 1) return;
      acumulado += ev.key;

      const leido = leerEscaneo(acumulado);
      if (!leido) return;

      ev.preventDefault();
      acumulado = '';
      ultimoEscaneo = ahora;
      avisar.current(leido);
    };

    document.addEventListener('keydown', alaTecla);
    return () => document.removeEventListener('keydown', alaTecla);
  }, [activo]);
}
