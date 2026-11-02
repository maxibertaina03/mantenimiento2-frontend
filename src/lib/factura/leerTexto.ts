import type { Palabra } from './interpretarFactura';

/**
 * Las palabras de una factura, con su posición, venga en PDF o en foto.
 *
 * Todo pasa en el navegador: la factura no sale de la computadora de quien la
 * carga, y no hace falta ningún servicio pago. Las dos librerías se bajan
 * recién la primera vez que se usan, como jsPDF.
 *
 * - PDF con texto (la factura electrónica de casi todos los sistemas): pdf.js
 *   lo saca tal cual, al instante y sin errores de lectura.
 * - Foto, o PDF escaneado sin texto adentro: OCR con Tesseract, en español.
 *   La primera vez baja el idioma (unos 10 MB) y después queda guardado.
 */

export type Avance = (etapa: string, fraccion: number) => void;

/** Un PDF con menos letras que esto por página es un escaneo: va por OCR. */
const MINIMO_LETRAS_POR_PAGINA = 40;

/** Más de esto no es una factura: es un error de archivo. */
const MAXIMO_PAGINAS = 10;

export async function leerFactura(archivo: Blob, avance: Avance = () => {}): Promise<Palabra[]> {
  if (archivo.type === 'application/pdf') {
    const { palabras, letras, paginas } = await textoDelPdf(archivo, avance);
    if (letras >= MINIMO_LETRAS_POR_PAGINA * paginas.length) return palabras;
    // Escaneado: cada página como imagen, al OCR.
    return ocr(paginas, avance);
  }
  return ocr([archivo], avance);
}

async function textoDelPdf(archivo: Blob, avance: Avance) {
  avance('Abriendo el PDF', 0);
  const pdfjs = await import('pdfjs-dist');
  const { default: urlTrabajador } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = urlTrabajador;

  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  const pdf = await tarea.promise;
  const total = Math.min(pdf.numPages, MAXIMO_PAGINAS);
  const palabras: Palabra[] = [];
  const paginas: HTMLCanvasElement[] = [];
  let letras = 0;
  for (let n = 1; n <= total; n++) {
    avance('Leyendo el PDF', (n - 1) / total);
    const pagina = await pdf.getPage(n);
    const vista = pagina.getViewport({ scale: 1 });
    const contenido = await pagina.getTextContent();
    for (const item of contenido.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const [, , , alto, x, y] = item.transform as number[];
      letras += item.str.replace(/\s/g, '').length;
      // El PDF mide desde abajo; acá se mide desde arriba.
      palabras.push({
        texto: item.str,
        x,
        y: vista.height - y,
        alto: Math.abs(alto) || 8,
        pagina: n,
      });
    }
    // Por si resulta ser un escaneo: la página dibujada, para el OCR.
    if (letras < MINIMO_LETRAS_POR_PAGINA * n) {
      const escala = 2;
      const v = pagina.getViewport({ scale: escala });
      const lienzo = document.createElement('canvas');
      lienzo.width = v.width;
      lienzo.height = v.height;
      await pagina.render({ canvas: lienzo, canvasContext: lienzo.getContext('2d')!, viewport: v })
        .promise;
      paginas.push(lienzo);
    }
  }
  await tarea.destroy();
  return { palabras, letras, paginas: paginas.length ? paginas : new Array(total).fill(null) };
}

async function ocr(imagenes: (Blob | HTMLCanvasElement)[], avance: Avance): Promise<Palabra[]> {
  avance('Preparando el lector de imágenes', 0);
  const { createWorker } = await import('tesseract.js');
  let paginaActual = 0;
  const trabajador = await createWorker('spa', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        avance('Leyendo la imagen', (paginaActual + m.progress) / imagenes.length);
      } else if (m.status.includes('loading')) {
        avance('Bajando el idioma (solo la primera vez)', m.progress);
      }
    },
  });
  try {
    const palabras: Palabra[] = [];
    for (const [i, imagen] of imagenes.entries()) {
      if (!imagen) continue;
      paginaActual = i;
      const { data } = await trabajador.recognize(imagen, {}, { blocks: true });
      for (const bloque of data.blocks ?? []) {
        for (const parrafo of bloque.paragraphs) {
          for (const renglon of parrafo.lines) {
            for (const w of renglon.words) {
              // Lo que el OCR leyó con muy poca seguridad es ruido.
              if (w.confidence < 30 || !w.text.trim()) continue;
              palabras.push({
                texto: w.text,
                x: w.bbox.x0,
                y: (w.bbox.y0 + w.bbox.y1) / 2,
                alto: w.bbox.y1 - w.bbox.y0,
                pagina: i + 1,
              });
            }
          }
        }
      }
    }
    return palabras;
  } finally {
    await trabajador.terminate();
  }
}
