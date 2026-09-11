import QRCode from 'qrcode';
import type { Equipo } from '@/tipos/equipo';
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
export function qrComoImagen(texto: string, lado = 320): Promise<string> {
  return QRCode.toDataURL(texto, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: lado,
    color: { dark: '#000000', light: '#ffffff' },
  });
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
      qr: await qrComoImagen(urlDeLaFicha(equipo.id, origen)),
      titulo: equipo.nombre,
      subtitulo: equipo.ubicacionNombre,
      pie: equipo.codigoInterno,
    })),
  );
}

/**
 * Las etiquetas de los materiales.
 *
 * **No lleva la cantidad impresa, a propósito.** El stock cambia todos los
 * días: una etiqueta que dice "quedan 12" queda mintiendo mañana, y una
 * etiqueta que miente es peor que ninguna. La cantidad se ve al escanear, que
 * siempre muestra lo que hay ahora.
 */
export async function armarEtiquetasMateriales(
  materiales: Material[],
  origen = baseDeLasEtiquetas(),
): Promise<Etiqueta[]> {
  return Promise.all(
    materiales.map(async (material) => ({
      qr: await qrComoImagen(urlDeLaFichaMaterial(material.id, origen)),
      titulo: material.nombre,
      subtitulo: material.categoriaNombre,
      pie: material.unidadNombre,
    })),
  );
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
export function imprimirEtiquetas(etiquetas: Etiqueta[]): boolean {
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
    /* Tres columnas de 60 mm entran cómodas en un A4 con margen de 10 mm. */
    grid-template-columns: repeat(3, 60mm);
    gap: 4mm;
    justify-content: center;
  }
  .etiqueta {
    border: 1px solid #000;
    border-radius: 2mm;
    padding: 3mm;
    height: 34mm;
    display: flex;
    align-items: center;
    gap: 3mm;
    /* Que una etiqueta no quede partida entre dos hojas. */
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .etiqueta img { width: 26mm; height: 26mm; flex: none; }
  .datos { min-width: 0; }
  .datos p { margin: 0; }
  .nombre {
    font-size: 10pt;
    font-weight: 700;
    line-height: 1.15;
    /* El nombre más largo del padrón entra en tres renglones a este cuerpo. */
    overflow-wrap: anywhere;
  }
  .sector { font-size: 8pt; margin-top: 1mm !important; }
  .codigo { font-size: 8pt; font-family: ui-monospace, Menlo, monospace; margin-top: 1mm !important; }
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
