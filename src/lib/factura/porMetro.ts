/**
 * Lo que el proveedor factura por metro y nosotros pedimos por unidad: el caño
 * viene en barras de 6 m, y Banchio factura 24 m por 4 barras. El nombre de
 * nuestro material dice cuántos metros trae cada unidad («… x 6 mts»).
 */

/** Los metros de una unidad, si el nombre los dice: «Barras caño ø50.8 x 6 mts» → 6. */
export function metrosPorUnidad(nombre: string | null): number | null {
  if (!nombre) return null;
  // «mts», «mt», «m», «metros», pero no «mm».
  const m = nombre.match(/(\d+(?:[.,]\d+)?)\s*(?:mts?|metros?|m)(?![a-z])/i);
  if (!m) return null;
  const metros = Number(m[1].replace(',', '.'));
  return metros > 1 ? metros : null;
}

/**
 * Por cuánto multiplicar el precio de la factura para llevarlo a nuestra
 * unidad. Solo cuando la cuenta no deja dudas: la cantidad facturada es la
 * pedida por los metros de cada unidad (4 barras de 6 m → 24). Si no, 1.
 */
export function factorAutomatico(
  nombre: string | null,
  pedida: number,
  facturada: number | null,
): number {
  const metros = metrosPorUnidad(nombre);
  if (!metros || facturada === null || pedida <= 0) return 1;
  return Math.abs(facturada - pedida * metros) < 0.01 ? metros : 1;
}

/** El precio por unidad nuestra, redondeado a centavos. */
export function porUnidad(precio: number, factor: number): number {
  return Math.round(precio * factor * 100) / 100;
}
