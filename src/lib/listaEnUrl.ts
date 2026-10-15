import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams, type Location } from 'react-router-dom';

/**
 * Los filtros, la búsqueda y la página de una lista, guardados en la dirección.
 *
 * Antes vivían en la memoria de la pantalla: se elegía «Electricidad», se iba a
 * la página 4, se entraba a un material y, al volver, la lista arrancaba de
 * cero. En la dirección (`/materiales?categoriaId=…&pagina=4`) sobreviven a ir
 * y volver, al botón «atrás» del navegador y a recargar; y el enlace a una
 * lista filtrada se puede compartir.
 *
 * Los cambios reemplazan la entrada del historial en vez de agregar una: así
 * «atrás» lleva a la pantalla anterior, no a cada filtro que se probó.
 */

export type TipoParametro = 'texto' | 'numero' | 'si';

/** Qué parámetros de la dirección son filtros de esta lista, y de qué tipo. */
export type EsquemaFiltros<F> = { [K in keyof F]-?: TipoParametro };

type Valor = string | number | boolean | undefined | null;

function leer<F>(parametros: URLSearchParams, esquema: EsquemaFiltros<F>): F {
  const filtros: Record<string, unknown> = {};
  for (const [clave, tipo] of Object.entries(esquema) as [string, TipoParametro][]) {
    const crudo = parametros.get(clave);
    if (crudo === null || crudo === '') continue;
    if (tipo === 'numero') {
      const n = Number(crudo);
      if (Number.isFinite(n)) filtros[clave] = n;
    } else if (tipo === 'si') {
      if (crudo === '1') filtros[clave] = true;
    } else {
      filtros[clave] = crudo;
    }
  }
  return filtros as F;
}

function escribir(parametros: URLSearchParams, clave: string, valor: Valor): void {
  // Vacío, falso o sin valor: el parámetro no va, así la dirección queda corta.
  if (valor === undefined || valor === null || valor === '' || valor === false) {
    parametros.delete(clave);
  } else {
    parametros.set(clave, valor === true ? '1' : String(valor));
  }
}

export function useListaEnUrl<F extends object>(esquema: EsquemaFiltros<F>) {
  const [parametros, setParametros] = useSearchParams();
  const texto = parametros.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- el esquema es fijo por pantalla
  const filtros = useMemo(() => leer<F>(new URLSearchParams(texto), esquema), [texto]);
  const pagina = Math.max(1, Math.floor(Number(parametros.get('pagina'))) || 1);

  /** Cambia algunos filtros. La página vuelve a la 1: la de antes puede no existir. */
  const cambiarFiltros = (cambios: Partial<F>) =>
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        for (const [clave, valor] of Object.entries(cambios))
          escribir(nuevos, clave, valor as Valor);
        nuevos.delete('pagina');
        return nuevos;
      },
      { replace: true },
    );

  /** Reemplaza todos los filtros de la lista (los demás parámetros quedan). */
  const reemplazarFiltros = (nuevosFiltros: F) =>
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        for (const clave of Object.keys(esquema)) nuevos.delete(clave);
        for (const [clave, valor] of Object.entries(nuevosFiltros)) {
          if (clave in esquema) escribir(nuevos, clave, valor as Valor);
        }
        nuevos.delete('pagina');
        return nuevos;
      },
      { replace: true },
    );

  const irAPagina = (n: number) =>
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        escribir(nuevos, 'pagina', n > 1 ? n : undefined);
        return nuevos;
      },
      { replace: true },
    );

  return { filtros, pagina, cambiarFiltros, reemplazarFiltros, irAPagina };
}

/**
 * El texto del buscador: se escribe al toque y llega a la dirección 300 ms
 * después de dejar de tipear, para no pedirle a la API una vez por letra.
 */
export function useBusquedaDemorada(enUrl: string | undefined, alCambiar: (b: string) => void) {
  const [buscar, setBuscar] = useState(enUrl ?? '');
  useEffect(() => {
    if (buscar === (enUrl ?? '')) return;
    const t = setTimeout(() => alCambiar(buscar), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia lo escrito
  }, [buscar]);
  return [buscar, setBuscar] as const;
}

/**
 * Lo que se le pasa a la ficha al abrirla desde la lista: la dirección de la
 * lista tal como estaba, para que «← Volver» deje todo igual.
 */
export function estadoParaVolver(ubicacion: Location): { volverA: string } {
  return { volverA: ubicacion.pathname + ubicacion.search };
}

/** A dónde vuelve la ficha: la lista como estaba o, si se llegó de otro lado (un QR), la lista sola. */
export function useVolverA(porDefecto: string): string {
  const estado = useLocation().state as { volverA?: unknown } | null;
  const volverA = estado?.volverA;
  return typeof volverA === 'string' && volverA.startsWith(porDefecto) ? volverA : porDefecto;
}
