/**
 * Sacar los renglones de una factura a partir de las palabras y su posición.
 *
 * Sin IA: las palabras salen del PDF (pdf.js) o de una foto (OCR), y acá se
 * arman los renglones por su altura en la hoja. Un renglón es un ítem si tiene
 * una descripción y números; de los números se busca la combinación que cierra
 * cantidad × precio unitario (− bonificación) = importe. Si cierra, el precio
 * es casi seguro; si no, se propone igual, marcado como dudoso, y la persona
 * lo revisa.
 */

/** Una palabra (o un trozo de texto) con dónde está en la hoja. */
export interface Palabra {
  texto: string;
  /** Desde la izquierda. */
  x: number;
  /** Desde arriba: más grande es más abajo. */
  y: number;
  /** El alto de la letra, para saber qué tan juntos están dos renglones. */
  alto: number;
  pagina: number;
}

export type LetraFactura = 'A' | 'B' | 'C';

export interface ItemLeido {
  indice: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number | null;
  precioUnitario: number | null;
  importe: number | null;
  bonificacion: number | null;
  /** Si los números cierran (cantidad × precio = importe). */
  cierra: boolean;
  /** El renglón tal cual se leyó, para mostrarlo. */
  textoOriginal: string;
}

export interface FacturaLeida {
  letra: LetraFactura | null;
  cuits: string[];
  items: ItemLeido[];
  /** Cuántos renglones de texto había: si hay muchos y ningún ítem, algo falló. */
  renglones: number;
}

/** Unidades que suelen ir pegadas a la cantidad: no cortan la cola de números. */
const UNIDADES = new Set([
  'ud',
  'uds',
  'u.',
  'un.',
  'u',
  'un',
  'uni',
  'unid',
  'unidad',
  'unidades',
  'kg',
  'kgs',
  'gr',
  'mt',
  'mts',
  'm',
  'ml',
  'lt',
  'lts',
  'l',
  'par',
  'pares',
  'jgo',
  'juego',
  'cja',
  'caja',
  'pza',
  'pzas',
  'rollo',
  'bolsa',
  'x',
  'c/u',
  'cu',
]);

/** Renglones que no son ítems: totales, impuestos, datos de la factura. */
const NO_ES_ITEM =
  /\b(sub ?total|total|iva|neto gravado|no gravado|exento|percep|percepci[oó]n|retenci[oó]n|ret\.|ingresos brutos|iibb|importe otros|son pesos|son:|cae\b|vto|vencimiento|cuit|fecha|factura|condici[oó]n|domicilio|p[aá]gina|hoja|remito|orden de compra|bonificaci[oó]n general|descuento general|transporte|saldo)\b/i;

/** Convierte un número escrito a la manera argentina (o yanqui) a número. */
export function leerNumero(textoCrudo: string): number | null {
  const t = textoCrudo
    .replace(/^\$|^ARS|^U\$S/i, '')
    .replace(/\$$/, '')
    .trim();
  if (!/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const ultimoPunto = t.lastIndexOf('.');
  const ultimaComa = t.lastIndexOf(',');
  let limpio: string;
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // Con los dos, el que va último es el decimal.
    limpio =
      ultimaComa > ultimoPunto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    // Solo coma: decimal, salvo que sea un separador de miles (1,234,567).
    limpio = /^-?\d{1,3}(,\d{3}){2,}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (ultimoPunto >= 0) {
    // Solo punto: de miles si hay grupos de tres (1.234 o 1.234.567), si no, decimal.
    limpio = /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t;
  } else {
    limpio = t;
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function leerPorcentaje(t: string): number | null {
  const m = /^-?([\d.,]+)\s*%$/.exec(t);
  return m ? leerNumero(m[1]) : null;
}

/** Agrupa las palabras en renglones: misma página y casi la misma altura. */
export function armarRenglones(palabras: Palabra[]): Palabra[][] {
  const ordenadas = [...palabras]
    .filter((p) => p.texto.trim() !== '')
    .sort((a, b) => a.pagina - b.pagina || a.y - b.y || a.x - b.x);
  const renglones: Palabra[][] = [];
  let actual: Palabra[] = [];
  let yActual = 0;
  let altoActual = 0;
  for (const p of ordenadas) {
    const tolerancia = Math.max(2, Math.min(altoActual || p.alto, p.alto) * 0.5);
    if (
      actual.length > 0 &&
      p.pagina === actual[0].pagina &&
      Math.abs(p.y - yActual) <= tolerancia
    ) {
      actual.push(p);
    } else {
      if (actual.length) renglones.push(actual);
      actual = [p];
      yActual = p.y;
      altoActual = p.alto;
    }
  }
  if (actual.length) renglones.push(actual);
  return renglones.map((r) => r.sort((a, b) => a.x - b.x));
}

const cerca = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.005);

/** Interpreta un renglón de texto. Null si no parece un ítem. */
export function interpretarRenglon(texto: string, indice: number): ItemLeido | null {
  if (NO_ES_ITEM.test(texto)) return null;
  const tokens = texto.split(/\s+/).filter(Boolean);

  // La cola de números del final: precio, importe, a veces la cantidad.
  const cola: { valor: number; pos: number }[] = [];
  const porcentajes: number[] = [];
  let corte = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    const n = leerNumero(t);
    const pct = leerPorcentaje(t);
    if (n !== null) cola.unshift({ valor: n, pos: i });
    else if (pct !== null) porcentajes.unshift(pct);
    else if (UNIDADES.has(t.toLowerCase()) || t === '$') {
      // sigue
    } else break;
    corte = i;
  }
  // Los números del principio: muchas facturas ponen la cantidad primero.
  const cabeza: number[] = [];
  let inicio = 0;
  // Un número largo al principio es el código del artículo («3000153»), no
  // una cantidad.
  let codigoNumerico: string | null = null;
  if (/^\d{5,}$/.test(tokens[0] ?? '') && corte > 1) {
    codigoNumerico = tokens[0];
    inicio = 1;
  }
  while (inicio < corte) {
    const n = leerNumero(tokens[inicio]);
    if (n === null) break;
    cabeza.push(n);
    inicio++;
  }

  let descripcionTokens = tokens.slice(inicio, corte);
  const letras = descripcionTokens.join(' ').replace(/[^\p{L}]/gu, '');
  if (letras.length < 3 || cola.length + cabeza.length < 2 || cola.length < 1) return null;

  // Un primer token corto con letras y números, si después hay más texto, es el código.
  let codigo: string | null = null;
  if (
    descripcionTokens.length > 1 &&
    /^[\p{L}\d][\p{L}\d\-./]{2,19}$/u.test(descripcionTokens[0]) &&
    /\d/.test(descripcionTokens[0])
  ) {
    codigo = descripcionTokens[0];
    descripcionTokens = descripcionTokens.slice(1);
  }
  if (codigoNumerico !== null) codigo = codigoNumerico;
  // Si la cabeza tenía dos números, el primero suele ser un código numérico.
  else if (cabeza.length >= 2 && codigo === null) codigo = String(tokens[0]);

  const bonificacion = porcentajes.length ? porcentajes[porcentajes.length - 1] : null;
  const importe = cola[cola.length - 1].valor;
  const candidatosCantidad = [...cabeza.map((v, i) => ({ valor: v, pos: -1 - i })), ...cola];

  // Se buscan cantidad, precio e importe que cierren. El importe no siempre es
  // el último número: hay facturas que después ponen el IVA y el total con
  // IVA del renglón. Puede cerrar de más de una forma (2 × 4.543,60 y
  // 4.543,60 × 2): se queda con la cantidad más creíble, un número redondo y
  // chico, y con el importe más a la izquierda (el neto, antes del IVA).
  const parejas: {
    c: number;
    p: number;
    imp: number;
    conBonif: boolean;
    puntos: number;
  }[] = [];
  for (const [i, imp] of cola.entries()) {
    for (const p of cola.slice(0, i)) {
      for (const c of candidatosCantidad) {
        if (c.pos === p.pos || c.pos === imp.pos || c.valor <= 0 || p.valor <= 0) continue;
        const bruto = c.valor * p.valor;
        const conBonif = bonificacion !== null ? bruto * (1 - bonificacion / 100) : bruto;
        if (!cerca(bruto, imp.valor) && !cerca(conBonif, imp.valor)) continue;
        // Un importe igual al precio con cantidad 1 cierra siempre: vale poco.
        const trivial = c.valor === 1 && p.valor === imp.valor ? -1 : 0;
        const redonda = Number.isInteger(c.valor) || Number.isInteger(c.valor * 2);
        parejas.push({
          c: c.valor,
          p: p.valor,
          imp: imp.valor,
          conBonif: !cerca(bruto, imp.valor),
          puntos: (redonda ? 4 : 0) + (c.valor <= p.valor ? 2 : 0) + trivial - i * 0.01,
        });
      }
    }
  }
  if (parejas.length > 0) {
    const mejor = parejas.sort((x, y) => y.puntos - x.puntos)[0];
    return {
      indice,
      codigo,
      descripcion: descripcionTokens.join(' '),
      cantidad: mejor.c,
      precioUnitario: mejor.p,
      importe: mejor.imp,
      bonificacion: mejor.conBonif ? bonificacion : null,
      cierra: true,
      textoOriginal: texto,
    };
  }

  // No cierra: se propone el anteúltimo como precio, y queda marcado como dudoso.
  const precio = cola.length >= 2 ? cola[cola.length - 2].valor : null;
  const cantidad =
    cabeza[cabeza.length - 1] ?? (cola.length >= 3 ? cola[cola.length - 3].valor : null);
  return {
    indice,
    codigo,
    descripcion: descripcionTokens.join(' '),
    cantidad,
    precioUnitario: precio ?? importe,
    importe: precio !== null ? importe : null,
    bonificacion,
    cierra: false,
    textoOriginal: texto,
  };
}

/** Un renglón sin precios, con texto, que no es un total: sigue la descripción de arriba. */
function esContinuacion(texto: string): boolean {
  const t = texto.trim();
  return (
    t.length >= 4 &&
    t.length <= 120 &&
    /\p{L}{3}/u.test(t) &&
    !NO_ES_ITEM.test(t) &&
    !/\d+[.,]\d{2}\s*$/.test(t)
  );
}

/**
 * La letra de la factura (o de la nota de crédito): por «FACTURA A» o por el
 * código de comprobante.
 */
export function detectarLetra(textos: string[]): LetraFactura | null {
  const todo = textos.join('\n');
  const codigo = /C[OÓ]D(?:IGO)?\.?\s*(?:N[°º.]?\s*)?0*(1|2|3|6|7|8|11|12|13)\b/i.exec(todo);
  // Factura, nota de débito y nota de crédito: 1/2/3 son A, 6/7/8 son B, 11/12/13 son C.
  if (codigo) {
    const n = Number(codigo[1]);
    return n <= 3 ? 'A' : n <= 8 ? 'B' : 'C';
  }
  const palabra = /(?:FACTURA|NOTA DE CR[EÉ]DITO)\s+([ABC])\b/i.exec(todo);
  if (palabra) return palabra[1].toUpperCase() as LetraFactura;
  // La letra sola, en su recuadro, en un renglón propio.
  const sola = textos.find((t) => /^[ABC]$/.test(t.trim()));
  return sola ? (sola.trim() as LetraFactura) : null;
}

/**
 * El CUIT de Lácteos Las Tres: en toda factura aparece como cliente. No es el
 * del proveedor, así que no cuenta para compararlo con el de la orden.
 */
export const CUIT_PROPIO = '30-66938972-4';

export function detectarCuits(textos: string[]): string[] {
  const vistos = new Set<string>();
  for (const t of textos) {
    for (const m of t.matchAll(/\b(20|23|24|27|30|33|34)-?(\d{8})-?(\d)\b/g)) {
      vistos.add(`${m[1]}-${m[2]}-${m[3]}`);
    }
  }
  vistos.delete(CUIT_PROPIO);
  return [...vistos];
}

export function interpretarFactura(palabras: Palabra[]): FacturaLeida {
  const textos = armarRenglones(palabras).map((r) => r.map((p) => p.texto.trim()).join(' '));
  const items: ItemLeido[] = [];
  const vistos = new Set<string>();
  let anterior: ItemLeido | null = null;
  for (const texto of textos) {
    const item = interpretarRenglon(texto, items.length);
    if (item) {
      // La misma factura en «Original» y «Duplicado»: el renglón va una vez.
      const clave = `${item.descripcion}|${item.cantidad}|${item.precioUnitario}`;
      if (vistos.has(clave)) {
        anterior = null;
        continue;
      }
      vistos.add(clave);
      items.push(item);
      anterior = item;
    } else if (anterior && esContinuacion(texto)) {
      // La descripción que siguió en el renglón de abajo (muchas facturas
      // copian ahí la descripción de la orden de compra): ayuda a relacionar.
      anterior.descripcion = `${anterior.descripcion} ${texto.trim()}`;
      anterior = null;
    } else {
      anterior = null;
    }
  }
  return {
    letra: detectarLetra(textos),
    cuits: detectarCuits(textos),
    items,
    renglones: textos.length,
  };
}

/** El precio sin IVA: la A ya es neta, la B trae el IVA adentro, la C no lleva IVA. */
export function aNeto(precio: number, letra: LetraFactura | null, alicuota: number): number {
  const neto = letra === 'B' ? precio / (1 + alicuota / 100) : precio;
  return Math.round(neto * 100) / 100;
}
