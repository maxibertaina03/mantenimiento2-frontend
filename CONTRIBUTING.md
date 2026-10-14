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

`main` está protegida: solo recibe cambios por pull request y con el CI en
verde (lint, tests y build), también para el administrador.

## El flujo

1. **Trabajar en `develop`**, nunca directo en `main`.

   ```bash
   git checkout develop
   ```

2. **Probar en local**:

   ```bash
   # en el repo de la API: npm run local:api
   npm run dev       # contra http://localhost:3000/api (.env.local)
   npm test
   npm run build
   ```

3. **Que lo apruebe quien lo pidió.** No alcanza con que los tests pasen: los
   tests dicen que el código hace lo que se le pidió, no que lo pedido sea lo
   que hacía falta. Hay que verlo funcionando.

4. **Commit con el formato acordado** (ver [Los commits](#los-commits)) y push a
   `develop`. El CI corre solo; hay que esperarlo en verde:

   ```bash
   git push origin develop
   gh run watch          # o mirar la pestaña Actions
   ```

5. **Pull request `develop` → `main`.** `main` no acepta pushes directos: solo
   entra por pull request y con el CI en verde, también para el administrador.
   El pull request lleva el resumen de lo que entra (la plantilla lo pide) y,
   si es una versión nueva, el `CHANGELOG.md` y el `package.json` ya
   actualizados (ver [Las versiones](#las-versiones)).

   ```bash
   gh pr create --base main --head develop --title "v1.2.0: recepción en partes"
   ```

6. **Mergear con «Create a merge commit»** (los otros modos están apagados):
   `develop` sigue viva, y un *squash* la dejaría desfasada de `main`. Al
   mergear, Vercel se publica solo.

7. **Marcar la versión y traer `main` a `develop`**:

   ```bash
   git fetch origin
   git tag -a v1.2.0 origin/main -m "v1.2.0"
   git push origin v1.2.0
   gh release create v1.2.0 --notes-from-tag   # o --notes con la entrada del CHANGELOG
   git checkout develop && git merge --ff-only origin/main && git push origin develop
   ```

## Los commits

Cada commit dice qué cambia, con este formato
([Conventional Commits](https://www.conventionalcommits.org/es/)):

```
tipo(ámbito): qué cambia, en presente y en castellano

Por qué hacía falta, si no es obvio: el problema que había, la decisión que se
tomó y lo que se descartó. Esto es lo que se lee dentro de un año.
```

- **El título**, hasta 72 caracteres. El **ámbito** es la parte que toca:
  `compras`, `trabajos`, `equipos`, `panol`, `informatica`, `hoy`, `modales`…
- **Los tipos**:

  | Tipo | Cuándo |
  |---|---|
  | `feat` | Algo nuevo que se puede usar |
  | `fix` | Un error arreglado |
  | `docs` | Solo documentación |
  | `refactor` | Cambia el código sin cambiar lo que hace |
  | `test` | Solo tests |
  | `perf` | Más rápido, mismo resultado |
  | `ci`, `build`, `chore` | El CI, la compilación, dependencias y orden |
  | `style` | Formato, sin cambio de código |
  | `revert` | Deshace un commit anterior |

- Ejemplos: `feat(compras): recibir una orden en varias entregas`,
  `fix(calendario): un service adelantado no cae en un día ya hecho`.
- **Un commit, un cambio.** Si el título necesita un «y», probablemente son dos.

El CI rechaza un push o pull request con commits que no siguen el formato
(`scripts/verificar-commits.mjs`). Se puede revisar antes de subir:

```bash
node scripts/verificar-commits.mjs origin/develop..HEAD
```

## Las versiones

Cada vez que algo llega a producción se marca una versión `vMAYOR.MENOR.PARCHE`
([versionado semántico](https://semver.org/lang/es/)):

| Sube | Cuándo | Ejemplo |
|---|---|---|
| **PARCHE** | Solo arreglos | 1.2.0 → 1.2.1 |
| **MENOR** | Algo nuevo, compatible con lo que había | 1.2.1 → 1.3.0 |
| **MAYOR** | Un cambio que obliga a cambiar el otro repo a la vez, o que rompe algo que se usaba | 1.3.0 → 2.0.0 |

Los dos repos se versionan por separado. En el mismo pull request:

1. `npm version <nueva> --no-git-tag-version` (actualiza `package.json` y el lock);
2. una entrada nueva arriba de todo en `CHANGELOG.md`, con lo que cambió **para
   quien usa el sistema**, no la lista de commits.

Después del merge, el tag y el Release en GitHub (paso 7 del flujo).

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
- [ ] Commits con el formato acordado
- [ ] Si es una versión nueva: `package.json` y `CHANGELOG.md` actualizados
