/**
 * Capturas reales del sistema, para el manual.
 *
 * Corre contra el frontend local apuntando a la API local, que a su vez lee la
 * base de produccion. Solo NAVEGA y abre ventanas: no envia ningun formulario,
 * asi que no crea ni modifica un solo dato.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SALIDA = process.argv[2] ?? './capturas';
mkdirSync(SALIDA, { recursive: true });

const navegador = await chromium.launch({ channel: 'chrome' });
const contexto = await navegador.newContext({
  viewport: { width: 1480, height: 900 },
  deviceScaleFactor: 2, // que se lea bien impreso
  locale: 'es-AR',
});
const pagina = await contexto.newPage();

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Una pantalla: a donde ir, que esperar a que aparezca, y que tocar antes. */
const PANTALLAS = [
  { archivo: 'hoy', ruta: '/', esperar: 'h1' },
  { archivo: 'materiales', ruta: '/materiales', esperar: 'table' },
  {
    archivo: 'material-detalle',
    ruta: '/materiales',
    esperar: 'table',
    hacer: async (p) => {
      await p.getByRole('button', { name: /^ver$/i }).first().click();
      await p.waitForSelector('.modal, [role=dialog]', { timeout: 10000 });
    },
  },
  { archivo: 'historial', ruta: '/historial', esperar: 'table' },
  { archivo: 'nuevo-movimiento', ruta: '/movimientos/nuevo', esperar: 'form, .panel' },
  { archivo: 'ordenes-compra', ruta: '/ordenes-compra', esperar: 'table' },
  {
    archivo: 'orden-compra-nueva',
    ruta: '/ordenes-compra',
    esperar: 'table',
    hacer: async (p) => {
      await p.getByRole('button', { name: /nueva orden/i }).click();
      await p.waitForSelector('form', { timeout: 10000 });
    },
  },
  {
    archivo: 'orden-compra-detalle',
    ruta: '/ordenes-compra',
    esperar: 'table',
    hacer: async (p) => {
      await p.getByRole('button', { name: /^ver$/i }).first().click();
      await esperar(1500);
    },
  },
  { archivo: 'proveedores', ruta: '/proveedores', esperar: 'table' },
  { archivo: 'equipos', ruta: '/equipos', esperar: 'table' },
  {
    archivo: 'equipo-detalle',
    ruta: '/equipos',
    esperar: 'table',
    hacer: async (p) => {
      await p.getByRole('button', { name: /^ver$/i }).first().click();
      await esperar(2000);
    },
  },
  { archivo: 'servicios', ruta: '/servicios', esperar: 'h1' },
  { archivo: 'equipos-it', ruta: '/equipos-it', esperar: 'table' },
  { archivo: 'credenciales', ruta: '/credenciales', esperar: 'h1' },
  { archivo: 'ordenes-trabajo', ruta: '/ordenes-trabajo', esperar: 'h1' },
  {
    archivo: 'orden-trabajo-nueva',
    ruta: '/ordenes-trabajo',
    esperar: 'h1',
    hacer: async (p) => {
      await p.getByRole('button', { name: /nueva orden/i }).click();
      await p.waitForSelector('form', { timeout: 10000 });
    },
  },
  { archivo: 'usuarios', ruta: '/usuarios', esperar: 'table' },
  { archivo: 'permisos', ruta: '/permisos', esperar: 'h1' },
];

const resultados = [];

for (const pantalla of PANTALLAS) {
  try {
    await pagina.goto(`http://localhost:5173${pantalla.ruta}`, { waitUntil: 'networkidle' });
    await pagina.waitForSelector(pantalla.esperar, { timeout: 15000 });
    // Un respiro para que terminen de pintarse las tablas y los resumenes.
    await esperar(1200);
    if (pantalla.hacer) await pantalla.hacer(pagina);
    await esperar(900);
    await pagina.screenshot({ path: `${SALIDA}/${pantalla.archivo}.png` });
    resultados.push(`  OK  ${pantalla.archivo}`);
  } catch (error) {
    resultados.push(`  FALLO  ${pantalla.archivo}: ${String(error.message).split('\n')[0]}`);
  }
}

console.log(resultados.join('\n'));
await navegador.close();
