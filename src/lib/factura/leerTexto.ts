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
      const { data } = await trabajador.recognize(
        await prepararParaOcr(imagen),
        {},
        { blocks: true },
      );
      for (const bloque of data.blocks ?? []) {
        for (const parrafo of bloque.paragraphs) {
          for (const renglon of parrafo.lines) {
            // Todas las palabras de una línea del OCR van a la misma altura:
            // en una foto apenas torcida, el precio de la derecha queda más
            // arriba o más abajo que la descripción, y por altura sola caerían
            // en renglones distintos.
            const y = (renglon.bbox.y0 + renglon.bbox.y1) / 2;
            const alto = renglon.bbox.y1 - renglon.bbox.y0;
            for (const w of renglon.words) {
              // Lo que el OCR leyó con muy poca seguridad es ruido.
              if (w.confidence < 30 || !w.text.trim()) continue;
              palabras.push({ texto: w.text, x: w.bbox.x0, y, alto, pagina: i + 1 });
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

/**
 * La imagen, lista para el OCR: más grande (unos 3000 px de ancho) y en gris
 * con todo el contraste. Las fotos de facturas tienen la letra chica, y así
 * el OCR confunde menos los dígitos (un 9 con un 3, una coma con un punto).
 */
async function prepararParaOcr(imagen: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const origen = imagen instanceof Blob ? await createImageBitmap(imagen) : imagen;
  const escala = Math.min(3, Math.max(1, 3000 / origen.width));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(origen.width * escala);
  lienzo.height = Math.round(origen.height * escala);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(origen, 0, 0, lienzo.width, lienzo.height);
  const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const px = datos.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const rango = Math.max(1, max - min);
  for (let i = 0; i < px.length; i += 4) {
    const v = ((px[i] - min) / rango) * 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(datos, 0, 0);
  return lienzo;
}
