# Cómo se trabaja en este proyecto

## La regla

> **Ningún cambio va a `main` sin haber sido aprobado en `develop`.**

`main` es lo que usa la gente todos los días: Vercel lo despliega
automáticamente y pega contra la API de producción en Render.

Esto no es una formalidad. El sistema está en uso: un error en `main` no es un
test que falla, es alguien que no puede cargar un movimiento.

## Las ramas

| Rama | Qué es | Contra qué API | Se despliega |
|---|---|---|---|
| `main` | Producción | Render | Vercel, automático |
| `develop` | Desarrollo y prueba | `localhost:3000` | No, se corre local |

## El flujo

1. **Trabajar en `develop`**, nunca directo en `main`.

   ```bash
   git checkout develop
   ```

2. **Levantar el backend en `develop`** (en el otro repo), que apunta a la base
   de desarrollo:

   ```bash
   npm run prueba:api
   ```

3. **Levantar el frontend contra ese backend.** En `.env.local`:

   ```
   VITE_API_URL=http://localhost:3000/api
   ```

   ```bash
   npm run dev
   npm test          # 206 tests
   ```

4. **Que lo apruebe quien lo pidió.** No alcanza con que los tests pasen: los
   tests dicen que el código hace lo que se le pidió, no que lo pedido sea lo
   que hacía falta. Hay que verlo funcionando.

5. **Recién ahí, pasar a `main`**:

   ```bash
   git checkout main
   git merge develop
   git push origin main      # esto despliega a producción
   ```

6. **Volver a `develop`** para lo siguiente.

## Ojo con el orden del deploy

Si el cambio necesita algo nuevo del backend, **el backend va primero**. Al
revés, el frontend nuevo le pide a la API de producción algo que todavía no
existe y falla.

## Antes de mergear a `main`

- [ ] Los tests pasan (`npm test`)
- [ ] Compila (`npx tsc -b` y `npm run build`)
- [ ] Sin errores de lint (`npx eslint . --ext ts,tsx`)
- [ ] Probado a mano en el navegador contra el backend local
- [ ] Probado en pantalla de celular: el sistema se usa desde el teléfono
- [ ] Si depende del backend, ese cambio ya está en producción
- [ ] Aprobado por quien pidió el cambio
