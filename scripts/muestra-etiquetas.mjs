/**
 * Genera una hoja de muestra de etiquetas de materiales, para imprimirla y
 * medirla contra una caja antes de tirar doscientas.
 *
 * Usa nombres reales del depósito, incluido el más largo que hay, que es el
 * caso que decide si el cuerpo de letra entra o no.
 *
 *   npm run muestra:etiquetas
 *   (abre dist-muestra/etiquetas-materiales.html e imprimí a escala 100%)
 */
import { mkdirSync, writeFileSync } from 'fs';
import QRCode from 'qrcode';

const FORMATO = { ancho: 80, alto: 27, qr: 22, columnas: 2, cuerpoNombre: 11, cuerpoSub: 9 };
const BASE = 'https://mantenimiento2-frontend.vercel.app';

/** Nombres reales, del más largo del padrón al más común. */
const MUESTRAS = [
  ['Palanca selecrtora manual neumatica 4 vias 3 2 posiciones + descanso', 'Neumática', null],
  ['Fuente de alimentacion conmutada, imput 200-500v, output 24V-28v 5A', 'Electricidad', null],
  ['Variador de frecuencia 240v mono a 240 trifasico 2,6A', 'Electricidad', null],
  ['Tornillo Allen avellanado 1/4 x 1 3/4 (6mm x 44mm)', 'Tornillería', null],
  ['Rodamiento a bolas yar206 (30x62x38,1)', 'Rodamientos', null],
  ['Valvula mariposa inox 1,5"', 'Cañerías', null],
  ['Terminal ojal 6mm rojo 1,5mm2', 'Consumibles', null],
  ['Balastro 4-65w', 'Electricidad', null],
  ['Caño galvanizado 1/2"', 'Cañerías', 'Metro'],
  ['Grasa rodamientos', 'Lubricantes', 'Kilogramo'],
  ['Junta 3"', 'Juntas', null],
  ['Buje', 'Repuestos', null],
];

const escapar = (t) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const celdas = [];
for (const [nombre, categoria, unidad] of MUESTRAS) {
  const id = '3da8524b-07ae-4c88-9108-' + String(celdas.length).padStart(12, '0');
  const qr = await QRCode.toDataURL(`${BASE}/materiales/${id}`, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });
  celdas.push(`
      <div class="etiqueta">
        <img src="${qr}" alt="">
        <div class="datos">
          <p class="nombre">${escapar(nombre)}</p>
          <p class="sector">${escapar(categoria)}</p>
          ${unidad ? `<p class="codigo">${escapar(unidad)}</p>` : ''}
        </div>
      </div>`);
}

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Muestra de etiquetas de materiales</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Arial, sans-serif; color: #000; background: #fff; }
  .hoja { display: grid; grid-template-columns: repeat(${FORMATO.columnas}, ${FORMATO.ancho}mm); gap: 4mm; justify-content: center; }
  .etiqueta {
    border: 1px solid #000; border-radius: 2mm; padding: 2.5mm;
    height: ${FORMATO.alto}mm; display: flex; align-items: center; gap: 2.5mm;
    break-inside: avoid; page-break-inside: avoid; overflow: hidden;
  }
  .etiqueta img { width: ${FORMATO.qr}mm; height: ${FORMATO.qr}mm; flex: none; }
  .datos { min-width: 0; }
  .datos p { margin: 0; }
  .nombre {
    font-size: ${FORMATO.cuerpoNombre}pt; font-weight: 700; line-height: 1.15;
    overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .sector { font-size: ${FORMATO.cuerpoSub}pt; margin-top: 1mm !important; }
  .codigo { font-size: ${FORMATO.cuerpoSub}pt; font-family: ui-monospace, Menlo, monospace; margin-top: 1mm !important; }
  .aviso { margin: 0 0 4mm; font-size: 9pt; }
  .regla { margin: 6mm 0 0; }
  .regla div { height: 6mm; border-left: 1px solid #000; border-right: 1px solid #000;
               border-bottom: 1px solid #000; width: 85mm; font-size: 7pt; padding-left: 1mm; }
  @media print { .aviso { display: none; } }
</style>
</head>
<body>
  <p class="aviso">
    Muestra. Imprimí a <strong>escala 100%</strong> (no "ajustar a la página") y medí una etiqueta:
    tiene que dar ${FORMATO.ancho} × ${FORMATO.alto} mm. Abajo hay una regla de 85 mm para
    comparar contra la caja.
  </p>
  <div class="hoja">${celdas.join('')}</div>
  <div class="regla"><div>85 mm: el ancho de la caja</div></div>
</body>
</html>`;

mkdirSync('dist-muestra', { recursive: true });
const salida = 'dist-muestra/etiquetas-materiales.html';
writeFileSync(salida, html, 'utf8');
console.log(`Listo: ${salida}`);
console.log(`Etiqueta ${FORMATO.ancho} x ${FORMATO.alto} mm, QR de ${FORMATO.qr} mm.`);
