# Mantenimiento — Pantallas

[![CI](https://github.com/maxibertaina03/mantenimiento2-frontend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/maxibertaina03/mantenimiento2-frontend/actions/workflows/ci.yml)

Las pantallas del sistema de mantenimiento de planta de **Lácteos Las Tres**: lo que se usa
todos los días desde la computadora y desde el celular, también escaneando el QR pegado en una
máquina o en un estante.

Todo pasa por la API, que vive en otro repo:
[`mantenimiento2-backend`](https://github.com/maxibertaina03/mantenimiento2-backend).

| | |
|---|---|
| **En producción** | https://mantenimiento2-frontend.vercel.app (Vercel, se publica solo desde `main`) |
| **Documentación del sistema** | [`docs/sistema.md`](https://github.com/maxibertaina03/mantenimiento2-backend/blob/main/docs/sistema.md) en el repo de la API |

## Qué tiene

| Pantalla | Para qué |
|---|---|
| **Hoy** | Las tareas de cada uno (lo de todos los días, junto en un renglón) y una tarjeta por cada cosa pendiente: equipos parados, services, pendientes anotados, talleres externos, reponer, mercadería por llegar. |
| **Materiales, Historial, Nuevo movimiento** | El pañol: stock, entradas y salidas (también con lector de QR), correcciones auditadas. |
| **Toma de inventario** | Contar el pañol por categoría, estantería o entero (a ciegas, desde el celular o en papel), lo que figura en 0 aparte, reubicar, y ajustar el stock a lo contado. |
| **Calendario** | Tareas por persona, primero el equipo y abajo la tarea; dos pestañas, «Services y tareas» y «Todos los días»; se imprime por semana o por mes. |
| **Pendientes** | El anotador de mantenimiento: lo que quedó por hacer (comprar, mandar a reparar), con urgente, a quién le toca y equipo. Se confirma antes de darlo por hecho y, si es sobre una máquina, se registra su orden de trabajo. |
| **Órdenes de trabajo** | Abrir, cargar materiales, cerrar; mandar a un taller de afuera y registrar la vuelta. |
| **Órdenes de compra** | Armar, enviar al proveedor, recibir en partes, reclamar lo que falta, PDF. |
| **Equipos y herramientas, Servicios** | La ficha de cada máquina (fotos, manuales, repuestos, componentes, planes) y lo que vence. |
| **Equipos IT, Contraseñas** | Inventario de informática y el baúl de contraseñas. |
| **Proveedores, Usuarios, Permisos** | Catálogo de proveedores, usuarios y qué puede hacer cada rol. |

Cada pantalla y cada botón aparecen solo para quien tiene el permiso; la API lo vuelve a
controlar.

## Stack

React 18 · TypeScript · Vite · React Router · TanStack React Query · Clerk (login) · jsPDF ·
Sentry · Vitest + Testing Library

## Estructura

```
src/
├── App.tsx           las rutas, cada una con su permiso
├── paginas/          una por pantalla
├── componentes/      piezas y modales (ordenesCompra/, ordenesTrabajo/, equiposIt/)
├── api/              un archivo por recurso, con los hooks de React Query
├── lib/              cliente HTTP, PDFs, QR, fechas, permisos, envíos por WhatsApp…
├── tipos/            la forma de los datos que devuelve la API
└── index.css         los estilos, con variables de color
docs/manual/          el manual para la gente que usa el sistema (y cómo regenerarlo)
```

## Levantarlo en una máquina

Hace falta **Node 24** con **npm 11.19 o más nuevo** (`npm install -g npm@11.19.1`). npm se niega a instalar con
una versión más vieja: el `package-lock.json` que arma no coincide con el del CI y `npm ci` falla en
GitHub aunque acá ande. Y la API corriendo en local (ver su README).

```bash
npm ci
cp .env.example .env.local      # VITE_API_URL=http://localhost:3000/api
npm run dev                     # http://localhost:5173
```

Sin `VITE_CLERK_PUBLISHABLE_KEY` corre sin login; en ese caso la API tiene que tener
`AUTH_DISABLED="true"`.

## Tests

```bash
npm test          # pantallas y componentes, como los usa una persona
npm run lint
npm run build     # tsc + vite
```

El CI corre los tres en cada push y pull request.

## Cómo se trabaja

Ramas, formato de los commits, pull requests y versiones: **[CONTRIBUTING.md](CONTRIBUTING.md)**.
Los cambios de cada versión: **[CHANGELOG.md](CHANGELOG.md)**.
