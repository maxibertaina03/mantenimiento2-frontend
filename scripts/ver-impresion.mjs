/**
 * Saca una foto de cómo va a salir una pantalla al imprimirla.
 *
 * Mirar la pantalla no alcanza: lo que se imprime lo decide el bloque
 * `@media print` de `index.css`, que esconde el menú, cambia la hoja a
 * horizontal y reacomoda todo. Esa parte no se ve nunca mientras se trabaja, y
 * es la que la gente de la planta lleva en la mano.
 *
 * Maneja el Chrome que ya está instalado por el protocolo de DevTools, sin
 * agregar ninguna dependencia al proyecto: Node ya trae WebSocket.
 *
 *   node scripts/ver-impresion.mjs /calendario salida.png
 */
import { execFile } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [ruta = '/calendario', salida = 'impresion.png'] = process.argv.slice(2);
const BASE = process.env.URL_BASE ?? 'http://localhost:5173';
const PUERTO_CDP = 9333;

const CHROMES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const navegador = CHROMES.find((c) => existsSync(c));
if (!navegador) {
  console.error('No encuentro Chrome ni Edge instalados.');
  process.exit(1);
}

// A4 horizontal a 96 puntos por pulgada. Es el tamaño de hoja que declara
// `@page { size: landscape }`, así que el ancho de la captura es el ancho real
// del papel: si algo no entra acá, tampoco entra impreso.
const ANCHO = 1123;
const ALTO = 794;

const perfil = mkdtempSync(join(tmpdir(), 'ver-impresion-'));
const chrome = execFile(navegador, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${perfil}`,
  `--remote-debugging-port=${PUERTO_CDP}`,
  `--window-size=${ANCHO},${ALTO}`,
  'about:blank',
]);

/** Espera a que el navegador levante su puerto de control. */
async function esperarCdp() {
  for (let intento = 0; intento < 40; intento++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {
      // Todavía no abrió. Se reintenta.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El navegador no abrió su puerto de control.');
}

const wsUrl = await esperarCdp();
const ws = new WebSocket(wsUrl);
await new Promise((listo, falla) => {
  ws.onopen = listo;
  ws.onerror = () => falla(new Error('No pude hablar con el navegador.'));
});

let id = 0;
const pendientes = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pendientes.has(msg.id)) {
    pendientes.get(msg.id)(msg.result);
    pendientes.delete(msg.id);
  }
};

/** Una orden del protocolo de DevTools. */
function cdp(metodo, params = {}, sessionId) {
  const mensaje = { id: ++id, method: metodo, params, ...(sessionId ? { sessionId } : {}) };
  return new Promise((resolver) => {
    pendientes.set(mensaje.id, resolver);
    ws.send(JSON.stringify(mensaje));
  });
}

const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });

await cdp('Page.enable', {}, sessionId);
await cdp('Emulation.setDeviceMetricsOverride',
  { width: ANCHO, height: ALTO, deviceScaleFactor: 2, mobile: false }, sessionId);

await cdp('Page.navigate', { url: `${BASE}${ruta}` }, sessionId);

// La pantalla pide sus datos después de dibujarse, así que esperar a que
// termine de cargar el HTML no alcanza: habría que fotografiar un calendario
// vacío. Se le da tiempo a que vuelva la consulta y se pinte.
await new Promise((r) => setTimeout(r, 9000));

// Acá está lo que hace a este script distinto de una captura común: se le dice
// al navegador que se comporte como si estuviera imprimiendo.
await cdp('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
await new Promise((r) => setTimeout(r, 1200));

const { data } = await cdp(
  'Page.captureScreenshot',
  { format: 'png', captureBeyondViewport: true },
  sessionId,
);

if (!data) {
  console.error('El navegador no devolvió ninguna imagen.');
  chrome.kill();
  process.exit(1);
}

writeFileSync(salida, Buffer.from(data, 'base64'));
console.log(`Listo: ${salida}  (${ruta}, como se vería impreso)`);

ws.close();
chrome.kill();
