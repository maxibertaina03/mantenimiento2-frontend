/**
 * Capturas reales del sistema, para el manual.
 *
 * Maneja el Chrome (o Edge) que ya está instalado, por su protocolo de
 * depuración: no hace falta instalar nada. Corre contra el frontend local
 * apuntando a la API local, que a su vez tiene una copia de producción.
 *
 * Solo NAVEGA y abre ventanas: no envía ningún formulario, así que no crea ni
 * modifica un solo dato.
 *
 *   node docs/manual/capturar.mjs [carpeta-de-salida] [dirección-del-frontend]
 *   node docs/manual/capturar.mjs docs/manual/capturas http://localhost:4173
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SALIDA = process.argv[2] ?? 'docs/manual/capturas';
const BASE = (process.argv[3] ?? 'http://localhost:4173').replace(/\/$/, '');
const PUERTO = 9341;
mkdirSync(SALIDA, { recursive: true });

const NAVEGADORES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const navegador = NAVEGADORES.find((c) => existsSync(c));
if (!navegador) {
  console.error('No encontré Chrome ni Edge instalados.');
  process.exit(1);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Las pantallas, en el orden del manual. `abrir` es código que corre en la
 * página para abrir una ficha o una ventana (siempre un clic, nunca un envío).
 */
const PANTALLAS = [
  { archivo: 'hoy', ruta: '/inicio' },
  { archivo: 'materiales', ruta: '/materiales' },
  {
    archivo: 'material-detalle',
    ruta: '/materiales',
    abrir: `document.querySelector('a[href^="/materiales/"]')?.click()`,
  },
  { archivo: 'historial', ruta: '/movimientos' },
  { archivo: 'nuevo-movimiento', ruta: '/movimientos/nuevo' },
  { archivo: 'inventario', ruta: '/inventario' },
  {
    archivo: 'toma',
    ruta: '/inventario',
    abrir: `document.querySelector('tbody tr td')?.click()`,
  },
  { archivo: 'ordenes-compra', ruta: '/ordenes-compra' },
  {
    archivo: 'orden-compra-nueva',
    ruta: '/ordenes-compra',
    abrir: `[...document.querySelectorAll('button')].find((b) => /nueva orden/i.test(b.textContent))?.click()`,
  },
  {
    archivo: 'orden-compra-detalle',
    ruta: '/ordenes-compra',
    abrir: `[...document.querySelectorAll('tbody button')].find((b) => b.textContent.trim() === 'Ver')?.click()`,
  },
  { archivo: 'proveedores', ruta: '/proveedores' },
  { archivo: 'equipos', ruta: '/equipos' },
  {
    archivo: 'equipo-ficha',
    ruta: '/equipos',
    abrir: `document.querySelector('tbody tr td')?.click()`,
  },
  { archivo: 'servicios', ruta: '/servicios' },
  { archivo: 'ordenes-trabajo', ruta: '/ordenes-trabajo' },
  { archivo: 'calendario', ruta: '/calendario' },
  { archivo: 'pendientes', ruta: '/pendientes' },
  { archivo: 'equipos-it', ruta: '/equipos-it' },
  { archivo: 'credenciales', ruta: '/credenciales' },
  { archivo: 'usuarios', ruta: '/usuarios' },
  { archivo: 'permisos', ruta: '/permisos' },
];

const perfil = mkdtempSync(join(tmpdir(), 'manual-'));
const chrome = execFile(navegador, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--lang=es-AR',
  `--user-data-dir=${perfil}`,
  `--remote-debugging-port=${PUERTO}`,
  'about:blank',
]);

let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try {
    const version = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json();
    wsUrl = version.webSocketDebuggerUrl;
  } catch {
    await esperar(250);
  }
}
const ws = new WebSocket(wsUrl);
await new Promise((ok) => (ws.onopen = ok));

let siguiente = 0;
const pendientes = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendientes.has(m.id)) {
    pendientes.get(m.id)(m.result ?? m.error);
    pendientes.delete(m.id);
  }
};
const cdp = (method, params = {}, sessionId) =>
  new Promise((r) => {
    const id = ++siguiente;
    pendientes.set(id, r);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId: s } = await cdp('Target.attachToTarget', { targetId, flatten: true });
await cdp('Page.enable', {}, s);
// 2x: que se lea bien impreso.
await cdp(
  'Emulation.setDeviceMetricsOverride',
  { width: 1480, height: 900, deviceScaleFactor: 2, mobile: false },
  s,
);

const evaluar = async (expresion) =>
  (await cdp('Runtime.evaluate', { expression: expresion, returnByValue: true }, s))?.result?.value;

/** Espera a que la página termine de cargar los datos (sin «Cargando…» a la vista). */
async function esperarDatos() {
  for (let i = 0; i < 40; i++) {
    const listo = await evaluar(
      `!!document.querySelector('h1') && !document.querySelector('.cargando, [aria-busy="true"]')`,
    );
    if (listo) return;
    await esperar(500);
  }
}

const resultados = [];
for (const p of PANTALLAS) {
  try {
    await cdp('Page.navigate', { url: BASE + p.ruta }, s);
    await esperar(1500);
    await esperarDatos();
    await esperar(1200);
    if (p.abrir) {
      await evaluar(p.abrir);
      await esperar(1500);
      await esperarDatos();
      await esperar(900);
    }
    await evaluar('window.scrollTo(0, 0)');
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' }, s);
    writeFileSync(join(SALIDA, `${p.archivo}.png`), Buffer.from(data, 'base64'));
    resultados.push(`  OK  ${p.archivo}`);
  } catch (error) {
    resultados.push(`  FALLO  ${p.archivo}: ${String(error?.message ?? error).split('\n')[0]}`);
  }
}

console.log(resultados.join('\n'));
ws.close();
chrome.kill();
