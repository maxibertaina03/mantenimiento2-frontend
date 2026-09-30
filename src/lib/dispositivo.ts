/**
 * Si la pantalla se usa con mouse (una computadora) y no con el dedo.
 *
 * Sirve para decidir el foco automático. En la computadora, que el cursor ya
 * esté en el buscador ahorra un clic. En el celular, el mismo foco abre el
 * teclado apenas se entra a la pantalla y tapa la mitad de lo que se quería
 * ver, sin que nadie lo haya pedido.
 *
 * Sin `matchMedia` (un navegador muy viejo, o los tests) se asume que no hay
 * mouse: es preferible perder el atajo que abrir un teclado de más.
 */
export function tieneMouse(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true;
}
