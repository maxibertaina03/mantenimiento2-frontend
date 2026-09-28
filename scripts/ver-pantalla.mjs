/**
 * Saca una foto de una pantalla, abriendo antes lo que haga falta.
 *
 * Es el hermano de `ver-impresion.mjs`, para lo que se ve en pantalla y no en
 * papel. Sirve para mirar un formulario que vive dentro de un modal: sin esto
 * hay que levantar todo a mano y hacer los clics uno mismo cada vez.
 *
 *   node scripts/ver-pantalla.mjs /ordenes-compra salida.png "+ Nueva orden"
 *
 * El tercer argumento es el texto de un botón que se aprieta antes de la foto.
 */
import { execFile } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [ruta = '/', salida = 'pantalla.png', botón] = process.argv.slice(2);
const BASE = process.env.URL_BASE ?? 'http://localhost:4173';
const PUERTO_CDP = 9334;

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

const ANCHO = 1500;
const ALTO = 1050;

const perfil = mkdtempSync(join(tmpdir(), 'ver-pantalla-'));
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

async function esperarCdp() {
  for (let intento = 0; intento < 40; intento++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {
      // Todavía no abrió.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El navegador no abrió su puerto de control.');
}

const ws = new WebSocket(await esperarCdp());
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
await cdp(
  'Emulation.setDeviceMetricsOverride',
  { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false },
  sessionId,
);
await cdp('Page.navigate', { url: `${BASE}${ruta}` }, sessionId);

// La pantalla pide sus datos después de dibujarse: esperar a que cargue el
// HTML no alcanza, habría que fotografiar una tabla vacía.
await new Promise((r) => setTimeout(r, 9000));

if (botón) {
  // Se busca por texto porque es lo que ve la persona, no por un selector que
  // cambia cada vez que alguien toca el marcado.
  const { result } = await cdp(
    'Runtime.evaluate',
    {
      expression: `
        (() => {
          const texto = ${JSON.stringify(botón)}.toLowerCase();
          const b = [...document.querySelectorAll('button')]
            .find((x) => (x.textContent || '').toLowerCase().includes(texto));
          if (!b) return 'no encontrado';
          b.click();
          return 'ok';
        })()
      `,
      returnByValue: true,
    },
    sessionId,
  );
  if (result?.value !== 'ok') {
    console.error(`No encontré el botón «${botón}».`);
    ws.close();
    chrome.kill();
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 2500));
}

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
console.log(`Listo: ${salida}  (${ruta}${botón ? ` tras apretar «${botón}»` : ''})`);

ws.close();
chrome.kill();
