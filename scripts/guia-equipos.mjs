/**
 * Genera la guía rápida del módulo Equipos en PDF.
 *
 * Se arma con jsPDF, que ya está en el proyecto para las órdenes de compra, así
 * que no suma ninguna dependencia. La salida es un archivo de verdad: se manda
 * por WhatsApp o se imprime sin depender de que nadie tenga acceso al sistema.
 *
 * Se corre con:
 *   node scripts/guia-equipos.js "ruta/de/salida.pdf"
 *
 * Vive en el repositorio para poder regenerarla cuando el módulo cambie: una
 * guía que se escribió una vez y quedó en la carpeta de alguien envejece sin
 * que nadie se entere.
 */
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'fs';

const SALIDA = process.argv[2] || 'Equipos - Guia rapida.pdf';

// ── Medidas de la hoja, en milímetros ──
const ANCHO = 210;
const ALTO = 297;
const MARGEN = 20;
const ANCHO_TEXTO = ANCHO - MARGEN * 2;
const PIE = ALTO - 18;

// ── Colores ──
const TINTA = [24, 29, 34];
const SUAVE = [92, 103, 113];
const ACENTO = [155, 34, 38];
const LINEA = [219, 224, 229];
const FONDO_CAJA = [244, 246, 248];

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
let y = MARGEN;
let pagina = 1;

/** Deja lugar para lo que sigue; si no entra, pasa de hoja. */
function reservar(alto) {
  if (y + alto > PIE - 6) {
    pieDePagina();
    doc.addPage();
    pagina += 1;
    y = MARGEN;
  }
}

function pieDePagina() {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SUAVE);
  doc.text('Sistema de mantenimiento · Lácteos Las Tres S.R.L.', MARGEN, PIE);
  doc.text(String(pagina), ANCHO - MARGEN, PIE, { align: 'right' });
}

function titulo(texto) {
  reservar(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TINTA);
  doc.text(texto, MARGEN, y);
  y += 9;
}

function seccion(numero, texto) {
  reservar(18);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ACENTO);
  doc.text(numero, MARGEN, y);
  doc.setFontSize(14);
  doc.setTextColor(...TINTA);
  doc.text(texto, MARGEN + 8, y);
  y += 3;
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y, ANCHO - MARGEN, y);
  y += 6;
}

function parrafo(texto, opciones = {}) {
  const { negrita = false, color = TINTA, sangria = 0 } = opciones;
  doc.setFont('helvetica', negrita ? 'bold' : 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...color);
  const lineas = doc.splitTextToSize(texto, ANCHO_TEXTO - sangria);
  for (const linea of lineas) {
    reservar(6);
    doc.text(linea, MARGEN + sangria, y);
    y += 5;
  }
  y += 2;
}

function vinieta(texto) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const lineas = doc.splitTextToSize(texto, ANCHO_TEXTO - 6);
  lineas.forEach((linea, i) => {
    reservar(6);
    if (i === 0) {
      doc.setTextColor(...ACENTO);
      doc.text('•', MARGEN + 1, y);
    }
    doc.setTextColor(...TINTA);
    doc.text(linea, MARGEN + 6, y);
    y += 5;
  });
  y += 1;
}

/** Un paso numerado, con su explicación. */
function paso(n, encabezado, detalle) {
  reservar(14);
  doc.setFillColor(...ACENTO);
  doc.circle(MARGEN + 2.6, y - 1.4, 2.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(n), MARGEN + 2.6, y - 0.1, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...TINTA);
  doc.text(encabezado, MARGEN + 8, y);
  y += 5;

  if (detalle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...SUAVE);
    const lineas = doc.splitTextToSize(detalle, ANCHO_TEXTO - 8);
    for (const linea of lineas) {
      reservar(6);
      doc.text(linea, MARGEN + 8, y);
      y += 4.6;
    }
  }
  y += 3;
}

/** Caja gris con un aviso. */
function caja(encabezado, texto) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lineas = doc.splitTextToSize(texto, ANCHO_TEXTO - 12);
  const alto = 10 + lineas.length * 4.6;
  reservar(alto + 4);

  doc.setFillColor(...FONDO_CAJA);
  doc.rect(MARGEN, y - 4, ANCHO_TEXTO, alto, 'F');
  doc.setFillColor(...ACENTO);
  doc.rect(MARGEN, y - 4, 1.2, alto, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ACENTO);
  doc.text(encabezado, MARGEN + 6, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  let yy = y + 6.5;
  for (const linea of lineas) {
    doc.text(linea, MARGEN + 6, yy);
    yy += 4.6;
  }
  y += alto + 3;
}

/** Tabla de dos columnas. */
function tabla(encabezados, filas, anchoPrimera = 52) {
  reservar(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...SUAVE);
  doc.text(encabezados[0].toUpperCase(), MARGEN, y);
  doc.text(encabezados[1].toUpperCase(), MARGEN + anchoPrimera, y);
  y += 2;
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, ANCHO - MARGEN, y);
  y += 5;

  for (const [izq, der] of filas) {
    const lineas = doc.splitTextToSize(der, ANCHO_TEXTO - anchoPrimera);
    reservar(lineas.length * 4.6 + 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
    doc.text(izq, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TINTA);
    let yy = y;
    for (const linea of lineas) {
      doc.text(linea, MARGEN + anchoPrimera, yy);
      yy += 4.6;
    }
    y = yy + 1.6;
    doc.setDrawColor(240, 243, 245);
    doc.line(MARGEN, y - 1, ANCHO - MARGEN, y - 1);
    y += 2;
  }
  y += 2;
}

// ═══════════════════════════ Contenido ═══════════════════════════

doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(...ACENTO);
doc.text('LÁCTEOS LAS TRES S.R.L.', MARGEN, y);
y += 8;

titulo('Equipos: guía rápida');
doc.setFont('helvetica', 'normal');
doc.setFontSize(11.5);
doc.setTextColor(...SUAVE);
const bajada = doc.splitTextToSize(
  'Cómo usar el módulo de máquinas de la planta: buscar una máquina, anotar un ' +
    'trabajo y programar los services para que el sistema avise solo.',
  ANCHO_TEXTO,
);
for (const l of bajada) {
  doc.text(l, MARGEN, y);
  y += 5.5;
}
y += 4;

seccion('01', 'Qué es');
parrafo(
  'Cada máquina de la planta tiene una ficha en el sistema: la caldera, los compresores, ' +
    'las tinas, las bombas, los tableros. Hoy hay 326 fichas cargadas, repartidas en 17 sectores.',
);
parrafo('En la ficha de cada máquina se ve, todo junto:');
vinieta('La foto, para reconocerla sin bajar a la planta.');
vinieta('Dónde está, de qué marca es y cuándo se compró.');
vinieta('Todo lo que se le hizo alguna vez, con fecha y quién lo hizo.');
vinieta('Cada cuánto hay que hacerle service y cuándo toca el próximo.');

seccion('02', 'Cómo encontrar una máquina');
parrafo('Hay tres formas, de la más rápida a la más lenta.');
paso(1, 'Escaneá el código QR', 'Si la máquina tiene la etiqueta pegada, se escanea con la cámara del celular y se abre su ficha directo.');
paso(2, 'Buscá por nombre o código', 'En la pantalla Equipos, escribí en el buscador de arriba. Sirve tanto el nombre como el número de la chapita.');
paso(3, 'Filtrá por sector', 'Con el botón Filtros elegís el sector y ves solo las máquinas de ahí.');

seccion('03', 'Cómo anotar un trabajo');
parrafo(
  'Cada vez que alguien le pone la mano a una máquina, conviene anotarlo. Es lo que después ' +
    'contesta "¿cuándo fue la última vez que le cambiamos el aceite a este compresor?".',
);
paso(1, 'Abrí la ficha de la máquina', 'Con el QR o buscándola.');
paso(2, 'Tocá "Registrar intervención"');
paso(3, 'Elegí qué clase de trabajo fue', 'Preventivo si estaba previsto, correctivo si se rompió, mejora si se le cambió algo para que ande mejor.');
paso(4, 'Poné quién lo hizo', 'En fábrica, y elegís la persona; o servicio externo, y elegís el proveedor.');
paso(5, 'Escribí qué se hizo', 'Este es el campo que alguien va a leer dentro de dos años. Vale la pena ser claro.');
paso(6, 'Si era un service programado, marcalo', 'Elegí el plan al que corresponde. El sistema mueve solo la fecha del próximo.');

caja(
  'La fecha se acomoda sola',
  'Si un service que tocaba en marzo se hizo recién en mayo, el próximo se cuenta desde mayo, ' +
    'no desde marzo. Nadie tiene que corregir fechas a mano.',
);

seccion('04', 'Los estados de una máquina');
parrafo(
  'El estado dice si la máquina está trabajando. Importa mantenerlo al día: el sistema no pide ' +
    'services de una máquina desafectada, así que la lista de trabajo no se llena de cosas que no hay que hacer.',
);
tabla(
  ['Estado', 'Cuándo se usa'],
  [
    ['Operativo', 'Anda y se usa. Es como están las 326 hoy.'],
    ['En reparación', 'Está parada porque se la está arreglando. Sigue pidiendo sus services.'],
    ['Fuera de servicio', 'Está parada y no se está arreglando. Deja de pedir services.'],
    ['Dado de baja', 'Se vendió o se descartó. De acá no se vuelve, así que se usa solo cuando la máquina ya no está.'],
  ],
  40,
);

seccion('05', 'Los planes de mantenimiento');
parrafo(
  'Un plan es una regla del tipo "al Compresor 1 hay que cambiarle el aceite cada 90 días". ' +
    'Se carga una sola vez y el sistema se encarga de recordarlo para siempre.',
);
parrafo('Se define desde la ficha de la máquina y lleva tres cosas:');
vinieta('Un nombre. Por ejemplo: "Cambio de aceite".');
vinieta('Cada cuántos días hay que hacerlo.');
vinieta('Cuándo toca la próxima vez. La primera se pone a ojo, con lo último que se recuerde.');
parrafo(
  'Una misma máquina puede tener varios planes a la vez. La caldera puede tener la purga semanal, ' +
    'el control de válvulas cada seis meses y la habilitación anual, cada uno con su ritmo.',
);

seccion('06', 'La pantalla Servicios');
parrafo(
  'Es la lista de trabajo: muestra qué services vencen, ordenados de lo más urgente a lo menos. ' +
    'Se puede mirar la semana, quince días, un mes o tres meses.',
);
tabla(
  ['Etiqueta', 'Qué significa'],
  [
    ['Vencido', 'La fecha ya pasó y nadie anotó el trabajo.'],
    ['Por vencer', 'Vence dentro de los próximos siete días.'],
    ['Al día', 'Falta más de una semana.'],
  ],
  40,
);

seccion('07', 'El correo de aviso');
parrafo(
  'Todos los días a las 7 de la mañana sale un correo con los services que vencen dentro de la ' +
    'semana y con los que ya vencieron. Es un solo correo con la lista completa, no uno por máquina.',
);
parrafo(
  'No se repite todos los días: vuelve a escribir recién cuando hay algo nuevo que avisar. Así el ' +
    'aviso no se convierte en ruido que nadie lee.',
);

caja(
  'Para que esto arranque',
  'Hoy no hay ningún plan cargado, así que el sistema todavía no tiene nada que avisar. ' +
    'Conviene empezar por diez máquinas críticas, las que frenan la producción si se paran, ' +
    'y cargarles el plan que ya se tiene en la cabeza.',
);

seccion('08', 'Preguntas rápidas');
tabla(
  ['Pregunta', 'Respuesta'],
  [
    ['¿Anotar un trabajo descuenta el repuesto del stock?', 'No. Si se usó un rodamiento, hay que descargarlo aparte, en Nuevo movimiento.'],
    ['¿Puedo borrar una máquina?', 'Conviene no hacerlo: se pierde su historial. Si ya no se usa, ponela como dada de baja.'],
    ['¿Y si me equivoco al anotar un trabajo?', 'Se puede editar. Todo queda registrado igual.'],
    ['¿Los avisos van por WhatsApp?', 'No, solo por correo. Lo de WhatsApp es para las órdenes de compra.'],
    ['¿Quién puede entrar a Equipos?', 'Por ahora, solo los administradores.'],
  ],
  62,
);

pieDePagina();

writeFileSync(SALIDA, Buffer.from(doc.output('arraybuffer')));
console.log('PDF generado: ' + SALIDA);
console.log('Páginas: ' + pagina);
