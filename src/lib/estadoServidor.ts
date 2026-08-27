import { useSyncExternalStore } from 'react';

/**
 * Estado global "el servidor está despertando".
 *
 * El backend corre en el plan free de Render, que apaga la instancia tras ~15
 * minutos sin tráfico. La primera request después de eso tarda 30-60s mientras
 * la instancia arranca, y hasta entonces el navegador recibe un fallo de red
 * (o un 502/503 del proxy) que se ve como un error rojo — o peor, como un
 * "error de CORS", porque una respuesta de error del proxy no trae headers CORS.
 *
 * El apiClient reintenta esas requests y avisa acá, para que la UI muestre
 * "despertando el servidor…" en vez de un error.
 *
 * Es un store mínimo (sin dependencias) consumido con useSyncExternalStore.
 */
let despertando = false;
const suscriptores = new Set<() => void>();

function notificar(): void {
  for (const fn of suscriptores) fn();
}

/** Lo llama el apiClient cuando detecta (o descarta) un arranque en frío. */
export function marcarDespertando(valor: boolean): void {
  if (despertando === valor) return;
  despertando = valor;
  notificar();
}

function suscribir(fn: () => void): () => void {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

function leer(): boolean {
  return despertando;
}

/** true mientras haya al menos una request esperando que el servidor arranque. */
export function useServidorDespertando(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false);
}

/** Solo para los tests: vuelve el store a su estado inicial. */
export function reiniciarEstadoServidor(): void {
  despertando = false;
  suscriptores.clear();
}
