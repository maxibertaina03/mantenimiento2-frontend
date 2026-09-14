import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';

/**
 * El servidor no acepta más de 100 por página. Pedirle "traeme los 911" de una
 * devuelve `limite must not be greater than 100`.
 */
const POR_PAGINA = 100;

/**
 * Cuántos pedidos van en el aire a la vez.
 *
 * Sin tope, un padrón de diez mil filas dispararía cien pedidos simultáneos y
 * el servidor de Render, que es chico, los encolaría igual o devolvería error.
 * Con seis, los 911 materiales entran en dos tandas.
 */
const EN_PARALELO = 6;

/**
 * Trae TODAS las filas de un listado paginado.
 *
 * Antes esto era un `for` que pedía una página, esperaba la respuesta, y recién
 * entonces pedía la siguiente. Para los 911 materiales de las etiquetas eran
 * diez idas y vueltas en fila india. La consulta tarda un milisegundo y medio;
 * lo que se siente es el viaje, repetido diez veces.
 *
 * Ahora la primera página dice cuántas hay en total, y el resto se piden juntas.
 *
 * El orden se conserva: las respuestas se vuelven a armar por número de página,
 * no por cuál llegó primero.
 */
export async function traerTodasLasPaginas<T>(
  ruta: string,
  query: Record<string, unknown> = {},
): Promise<T[]> {
  const pedir = (pagina: number) =>
    apiRequest<RespuestaPaginada<T>>(ruta, {
      query: { ...query, pagina, limite: POR_PAGINA },
    });

  const primera = await pedir(1);
  // Un total mal informado no tiene que dejar la pantalla pidiendo páginas
  // vacías para siempre: si la primera vino sin datos, no hay nada más.
  if (primera.datos.length === 0) return [];

  const cuantasPaginas = Math.ceil(primera.total / POR_PAGINA);
  if (cuantasPaginas <= 1) return primera.datos;

  const restantes = Array.from({ length: cuantasPaginas - 1 }, (_, i) => i + 2);
  const porPagina: T[][] = [primera.datos];

  for (let i = 0; i < restantes.length; i += EN_PARALELO) {
    const tanda = restantes.slice(i, i + EN_PARALELO);
    const respuestas = await Promise.all(tanda.map(pedir));
    for (const r of respuestas) porPagina.push(r.datos);
  }

  return porPagina.flat();
}
