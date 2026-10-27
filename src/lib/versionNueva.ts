/**
 * Si se publicó una versión nueva con la página abierta, recargarla.
 *
 * Algunas partes del sistema (el armado de los PDF, por ejemplo) se bajan
 * recién cuando se usan. Si mientras la pestaña estaba abierta se publicó una
 * versión nueva, esas partes ya no existen con el nombre viejo, y el botón
 * fallaba sin decir nada: «Imprimir orden» no hacía nada hasta recargar.
 *
 * Vite avisa con `vite:preloadError` cuando no puede bajar una de esas partes.
 * Se recarga una sola vez: si la parte falta también después de recargar, es
 * otro problema, y el error tiene que verse en vez de recargar sin fin.
 */
const CLAVE = 'recargado-por-version-nueva';
/** Dentro de este lapso, una segunda falla no vuelve a recargar. */
const VENTANA_MS = 60_000;

export function recargarSiHayVersionNueva(): void {
  window.addEventListener('vite:preloadError', (evento) => {
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(CLAVE)) || 0;
    } catch {
      // Sin almacenamiento (modo privado estricto): se recarga igual una vez.
    }
    if (Date.now() - ultima < VENTANA_MS) return;
    try {
      sessionStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      // Ídem.
    }
    // Que el error no llegue al botón: la página se está recargando.
    evento.preventDefault();
    window.location.reload();
  });
}
