import QRCode from 'qrcode';
import type { Equipo } from '@/tipos/equipo';
import type { EquipoIt } from '@/tipos/equipoIt';
import type { Material } from '@/tipos/material';

/**
 * Etiquetas con código QR para pegar en las máquinas.
 *
 * El QR lleva la dirección de la ficha del equipo en el sistema, así que
 * escanearlo con la cámara del celular la abre directamente. No lleva los datos
 * adentro a propósito: una etiqueta con el nombre y el sector impresos adentro
 * del código quedaría desactualizada el día que la máquina se mueva de sector,
 * y habría que reimprimir 326 etiquetas.
 */

/**
 * La dirección con la que se arman las etiquetas.
 *
 * `VITE_URL_PUBLICA` existe porque la etiqueta se pega en una máquina y se
 * escanea desde un celular: si se imprime con la dirección del entorno local,
 * el QR lleva a `http://localhost:5173`, que en el celular no es ningún lado.
 * Y eso no se descubre hasta tener 326 etiquetas pegadas.
 *
 * Sin la variable cae en la dirección desde la que se está usando el sistema,
 * que es la correcta cuando se imprime desde el sistema publicado.
 */
export function baseDeLasEtiquetas(): string {
  const configurada = import.meta.env.VITE_URL_PUBLICA as string | undefined;
  return (configurada?.trim() || window.location.origin).replace(/\/+$/, '');
}

/** Una dirección que solo funciona en la computadora que la generó. */
export function esDireccionLocal(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(url);
}

/** A dónde apunta el QR de un equipo. */
export function urlDeLaFicha(equipoId: string, origen = baseDeLasEtiquetas()): string {
  return `${origen.replace(/\/+$/, '')}/equipos?equipo=${equipoId}`;
}

/**
 * A dónde apunta el QR de un equipo de informática.
 *
 * Misma forma que la de los equipos de planta —parámetro sobre el listado— pero
 * contra otra pantalla. La palabra "it" en la dirección es lo que después deja
 * distinguir las dos etiquetas al escanearlas (ver `leerEscaneo`).
 */
export function urlDeLaFichaEquipoIt(equipoId: string, origen = baseDeLasEtiquetas()): string {
  return `${origen.replace(/\/+$/, '')}/equipos-it?equipo=${equipoId}`;
}

/**
 * A dónde apunta el QR de un material.
 *
 * La ficha del material es una página propia, no un parámetro sobre el listado
 * como en los equipos, así que la dirección es más directa.
 */
export function urlDeLaFichaMaterial(materialId: string, origen = baseDeLasEtiquetas()): string {
  return `${origen.replace(/\/+$/, '')}/materiales/${materialId}`;
}

/**
 * El QR como imagen, listo para meter en el HTML de impresión.
 *
 * Sale en PNG y no en SVG porque la ventana de impresión tiene que poder
 * renderizarlo sin depender de nada más, y un `data:` de PNG viaja adentro del
 * propio HTML.
 *
 * Corrección de errores alta: la etiqueta va pegada en una máquina, donde se
 * ensucia con grasa y se raya. Con `H` el código sigue leyéndose con hasta un
 * 30% de la superficie tapada.
 */
export function qrComoImagen(
  texto: string,
  lado = 320,
  correccion: 'H' | 'M' = 'H',
): Promise<string> {
  return QRCode.toDataURL(texto, {
    errorCorrectionLevel: correccion,
    margin: 1,
    width: lado,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Los dos formatos de etiqueta, con sus medidas en milímetros.
 *
 * `equipo` va pegada en una máquina y tiene lugar de sobra. `material` va en la
 * cara de una caja de 30 × 85 mm, así que la etiqueta mide un poco menos para
 * poder pegarla derecha sin que sobresalga.
 */
export interface FormatoEtiqueta {
  ancho: number;
  alto: number;
  qr: number;
  columnas: number;
  /** Cuerpo del nombre, de la línea del medio y del pie, en puntos. */
  cuerpoNombre: number;
  cuerpoSub: number;
}

export const FORMATOS: Record<'equipo' | 'material', FormatoEtiqueta> = {
  equipo: { ancho: 60, alto: 34, qr: 26, columnas: 3, cuerpoNombre: 10, cuerpoSub: 8 },
  // 80 × 27 entra en una caja de 85 × 30 con unos dos milímetros y medio de
  // aire por lado, que es lo que hace falta para pegarla sin pelearse.
  material: { ancho: 80, alto: 27, qr: 22, columnas: 2, cuerpoNombre: 11, cuerpoSub: 9 },
};

/** Cuántas etiquetas de este formato entran en una hoja A4 con margen de 10 mm. */
export function etiquetasPorHoja(formato: FormatoEtiqueta): number {
  const SEPARACION = 4;
  const filas = Math.floor((297 - 20 + SEPARACION) / (formato.alto + SEPARACION));
  return filas * formato.columnas;
}

/**
 * Una etiqueta impresa, ya sea de una máquina o de un material.
 *
 * Es genérica para que la hoja se arme una sola vez: los dos módulos imprimen
 * en el mismo formato y con el mismo tamaño, y duplicar el armado garantizaría
 * que en algún momento se corrija un margen en uno y no en el otro.
 */
export interface Etiqueta {
  qr: string;
  titulo: string;
  /** La línea de abajo: el sector de la máquina, o la categoría del material. */
  subtitulo?: string | null;
  /** El renglón chico del final: el código interno, o la unidad de medida. */
  pie?: string | null;
}

export async function armarEtiquetas(
  equipos: Equipo[],
  origen = baseDeLasEtiquetas(),
): Promise<Etiqueta[]> {
  return Promise.all(
    equipos.map(async (equipo) => ({
      // Corrección alta: la etiqueta de una máquina se ensucia con grasa y se
      // raya, y con `H` sigue leyéndose con hasta un 30% de la superficie tapada.
      qr: await qrComoImagen(urlDeLaFicha(equipo.id, origen), 320, 'H'),
      titulo: equipo.nombre,
      subtitulo: equipo.ubicacionNombre,
      pie: equipo.codigoInterno,
    })),
  );
}

/**
 * La unidad solo se imprime cuando dice algo.
 *
 * De 373 materiales, 368 tienen unidad "Unidad". Imprimirlo en todos gasta un
 * renglón de la etiqueta para repetir lo que ya se da por sentado, y en una
 * etiqueta de 27 mm ese renglón es el que le falta al nombre.
 */
function unidadQueAporta(unidad: string | null | undefined): string | null {
  if (!unidad) return null;
  return unidad.trim().toLowerCase() === 'unidad' ? null : unidad;
}

/**
 * Las etiquetas de los materiales.
 *
 * **No lleva la cantidad impresa, a propósito.** El stock cambia todos los
 * días: una etiqueta que dice "quedan 12" queda mintiendo mañana, y una
 * etiqueta que miente es peor que ninguna. La cantidad se ve al escanear, que
 * siempre muestra lo que hay ahora.
 *
 * Corrección media y no alta, al revés que en las máquinas. Es una decisión de
 * tamaño: con `H`, un QR de 22 mm deja cada módulo en 0,38 mm y un celular
 * empieza a pelearla; con `M` quedan 0,49 mm, que se lee cómodo. Estas van
 * pegadas en cajas de cartón adentro del depósito, no en una bomba llena de
 * grasa, así que la tolerancia extra de `H` no hace falta.
 */
export async function armarEtiquetasMateriales(
  materiales: Material[],
  origen = baseDeLasEtiquetas(),
): Promise<Etiqueta[]> {
  return Promise.all(
    materiales.map(async (material) => ({
      qr: await qrComoImagen(urlDeLaFichaMaterial(material.id, origen), 320, 'M'),
      titulo: material.nombre,
      subtitulo: material.categoriaNombre,
      pie: unidadQueAporta(material.unidadNombre),
    })),
  );
}

/**
 * Las etiquetas de los equipos de informática.
 *
 * El título se arma igual que en la pantalla: marca y modelo, y si faltan, el
 * código interno. Un equipo de informática no tiene columna `nombre`.
 *
 * Corrección media y no alta, al revés que en las máquinas de planta: estas van
 * pegadas en un gabinete o en el borde de un monitor, limpias, no en una bomba
 * llena de grasa. Con `M` cada módulo del código queda más grande y el celular
 * lo lee más rápido.
 */
export async function armarEtiquetasEquiposIt(
  equipos: EquipoIt[],
  origen = baseDeLasEtiquetas(),
): Promise<Etiqueta[]> {
  return Promise.all(
    equipos.map(async (equipo) => ({
      qr: await qrComoImagen(urlDeLaFichaEquipoIt(equipo.id, origen), 320, 'M'),
      titulo: nombreDeEquipoIt(equipo),
      subtitulo: equipo.ubicacionNombre,
      pie: equipo.codigoInterno,
    })),
  );
}

/**
 * Cómo se nombra un equipo de informática en una línea.
 *
 * Vive acá y no en la pantalla porque lo usan las dos: la lista y la etiqueta
 * impresa. Si cada una lo armara por su cuenta, la etiqueta pegada en la
 * máquina podría decir algo distinto de lo que dice el sistema.
 */
export function nombreDeEquipoIt(e: {
  marcaNombre?: string | null;
  modeloNombre?: string | null;
  codigoInterno?: string | null;
  tipoNombre?: string | null;
}): string {
  const marcaYModelo = [e.marcaNombre, e.modeloNombre].filter(Boolean).join(' ');
  return marcaYModelo || e.codigoInterno || e.tipoNombre || 'Equipo sin identificar';
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Arma la hoja de etiquetas y abre el diálogo de impresión.
 *
 * Va en una ventana aparte y no en un `<div>` escondido de la aplicación:
 * imprimir la página actual arrastraría el menú lateral, los estilos y todo lo
 * demás, y la hoja saldría con la mitad de la tinta gastada en cosas que no son
 * la etiqueta.
 *
 * Devuelve `false` si el navegador bloqueó la ventana emergente, para que la
 * pantalla pueda avisarlo en vez de quedarse en silencio.
 */
export function imprimirEtiquetas(
  etiquetas: Etiqueta[],
  formato: FormatoEtiqueta = FORMATOS.equipo,
): boolean {
  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (!ventana) return false;

  const celdas = etiquetas
    .map(({ qr, titulo, subtitulo, pie }) => {
      const sub = subtitulo ? escapar(subtitulo) : '';
      const abajo = pie ? escapar(pie) : '';
      return `
      <div class="etiqueta">
        <img src="${qr}" alt="Código QR de ${escapar(titulo)}">
        <div class="datos">
          <p class="nombre">${escapar(titulo)}</p>
          ${sub ? `<p class="sector">${sub}</p>` : ''}
          ${abajo ? `<p class="codigo">${abajo}</p>` : ''}
        </div>
      </div>`;
    })
    .join('');

  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiquetas de equipos</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, Segoe UI, Arial, sans-serif;
    color: #000;
    background: #fff;
  }
  .hoja {
    display: grid;
    grid-template-columns: repeat(${formato.columnas}, ${formato.ancho}mm);
    gap: 4mm;
    justify-content: center;
  }
  .etiqueta {
    border: 1px solid #000;
    border-radius: 2mm;
    padding: 2.5mm;
    height: ${formato.alto}mm;
    display: flex;
    align-items: center;
    gap: 2.5mm;
    /* Que una etiqueta no quede partida entre dos hojas. */
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .etiqueta img { width: ${formato.qr}mm; height: ${formato.qr}mm; flex: none; }
  .datos { min-width: 0; }
  .datos p { margin: 0; }
  .nombre {
    font-size: ${formato.cuerpoNombre}pt;
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
    /* Tope de tres renglones: el nombre más largo del padrón entra, y si
       apareciera uno peor no empuja la categoría fuera de la etiqueta. */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sector { font-size: ${formato.cuerpoSub}pt; margin-top: 1mm !important; }
  .codigo {
    font-size: ${formato.cuerpoSub}pt;
    font-family: ui-monospace, Menlo, monospace;
    margin-top: 1mm !important;
  }
  .aviso { margin: 0 0 4mm; font-size: 9pt; }
  @media print { .aviso { display: none; } }
</style>
</head>
<body>
  <p class="aviso">
    Se van a imprimir ${etiquetas.length} etiqueta(s). Si no se abre solo el diálogo de
    impresión, usá Ctrl+P.
  </p>
  <div class="hoja">${celdas}</div>
</body>
</html>`);
  ventana.document.close();

  // Se espera a que las imágenes carguen: imprimir antes saca las etiquetas en
  // blanco, con el recuadro y sin el código.
  ventana.onload = () => {
    ventana.focus();
    ventana.print();
  };
  return true;
}
