# Mantenimiento — Frontend

Interfaz web para la **gestión de stock de materiales** de un área de mantenimiento.
Consume la API de NestJS del repo `mantenimiento2-backend`.

Construida con **React + TypeScript + Vite + TanStack Query**.

> Este repo es **autónomo**. Necesita el backend corriendo para funcionar.

---

## Stack

- **React 18 + TypeScript + Vite**
- **TanStack Query (React Query)** para data fetching y cache
- **React Router** para navegación
- Cliente HTTP tipado que lee la URL base desde `VITE_API_URL`
- UI propia con CSS simple (sin librería de diseño pesada)

---

## Requisitos

- Node.js 18+ y npm.
- El backend (`mantenimiento2-backend`) corriendo y accesible.

---

## 1. Instalar dependencias

```bash
npm install
```

## 2. Variables de entorno

```bash
cp .env.example .env
```

| Variable                       | Descripción                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| `VITE_API_URL`                 | URL base de la API **incluyendo `/api`**. Default `http://localhost:3000/api`. |
| `VITE_CLERK_PUBLISHABLE_KEY`   | (Futuro) key de Clerk. Hoy sin uso, auth desactivada.              |

> Debe coincidir con el `FRONTEND_URL` configurado en el CORS del backend
> (por defecto el backend permite `http://localhost:5173`, que es el puerto de Vite).

## 3. Levantar en desarrollo

```bash
npm run dev
```

Abre en `http://localhost:5173`.

## 4. Build de producción

```bash
npm run build      # type-check (tsc) + bundle (vite)
npm run preview    # sirve el build localmente
```

---

## Pantallas

| Ruta                  | Pantalla                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `/materiales`         | Lista de materiales + alerta de los que están bajo stock mínimo    |
| `/materiales/:id`     | Detalle del material con su historial de movimientos               |
| `/movimientos/nuevo`  | Alta de movimiento (ENTRADA / SALIDA / AJUSTE) con su lógica       |
| `/proveedores`        | ABM de proveedores (alta, edición, baja)                           |

---

## Estructura

```
src/
├── main.tsx              # QueryClientProvider + Router (ClerkProvider preparado/comentado)
├── App.tsx               # rutas
├── index.css             # estilos
├── lib/
│   ├── apiClient.ts      # fetch tipado (lee VITE_API_URL) + manejo de errores
│   ├── queryClient.ts    # config de React Query
│   └── formato.ts        # helpers de fecha/número
├── tipos/                # interfaces espejo de los DTOs del backend
├── api/                  # hooks de React Query por dominio
├── componentes/          # UI reutilizable (Layout, Modal, Estados, Badge)
└── paginas/              # las 4 pantallas
```

---

## Autenticación (Clerk)

La app usa **Clerk**. El comportamiento depende de si `VITE_CLERK_PUBLISHABLE_KEY` está
configurada:

- **Con key** → toda la app queda detrás del login. Sin sesión se muestra la pantalla de
  Clerk (`<SignIn />`); con sesión, el token se adjunta automáticamente a cada request de
  la API (`Authorization: Bearer …`) y aparece el `UserButton` en el sidebar.
- **Sin key** → la app corre **sin auth** (modo desarrollo). En ese caso el backend debe
  tener `AUTH_DISABLED="true"`.

### Configurar Clerk

1. Creá una aplicación en [clerk.com](https://clerk.com) (la misma instancia que el backend).
2. En **API Keys**, copiá la **Publishable key** (`pk_test_…`).
3. En el `.env`:
   ```
   VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
   ```
4. Reiniciá `npm run dev`. Asegurate de que el backend tenga su `CLERK_SECRET_KEY` puesta
   y `AUTH_DISABLED="false"`.

Piezas clave: `src/main.tsx` (gate de login), `src/componentes/ProveedorToken.tsx`
(registra el token) y `src/lib/apiClient.ts` (lo adjunta a las requests).

---

## Notas

- El cliente API centraliza las llamadas en `lib/apiClient.ts`; si cambia la forma de
  respuesta del backend, se ajusta en un solo lugar.
- Las mutaciones invalidan las queries afectadas (p. ej. registrar un movimiento refresca
  el stock de materiales automáticamente).
```
