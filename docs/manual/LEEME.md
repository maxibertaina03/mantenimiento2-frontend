# Manual del sistema

El manual en PDF que se le entrega a la gente que usa el sistema. Acá está lo que
hace falta para volver a generarlo cuando las pantallas cambien.

Las capturas **no** se versionan. Son casi 5 MB que quedan viejas a la primera
pantalla que se toque, y una imagen desactualizada en un manual es peor que no
tener manual: enseña algo que ya no es. Se vuelven a sacar cada vez.

## Qué hay acá

| Archivo | Qué es |
| --- | --- |
| `manual.html` | El texto del manual y su diseño. Es lo que se edita. |
| `capturar.mjs` | Saca las capturas del sistema andando. |

## Cómo se regenera

Hace falta Chrome instalado. Playwright se instala solo para esto y después se
saca, para no dejar 100 MB de dependencia por una tarea que se hace cada tanto.

**1. Levantar el sistema con datos reales y como administrador.**

El manual muestra la vista del administrador, así que el backend tiene que
correr con un usuario de verdad. En el `.env` del backend:

```
AUTH_DISABLED="true"
USUARIO_DEV="telecomunicaciones@lacteoslastres.com.ar"
```

Y el frontend apuntando a ese backend, sin Clerk, para que no pida login:

```
VITE_API_URL=http://localhost:5173/api
VITE_CLERK_PUBLISHABLE_KEY=
```

Con eso, `npm run start:prod` en el backend y `npm run dev` acá.

**2. Sacar las capturas.**

```
npm i -D playwright
node docs/manual/capturar.mjs docs/manual/capturas
```

El script solo navega y abre ventanas. No envía ningún formulario, así que no
crea ni modifica un solo dato. Igual conviene revisarlo antes de correrlo si se
le agregaron pasos.

**3. Armar el PDF.**

Abrir `manual.html` en Chrome e imprimir a PDF, con márgenes de 16 mm arriba y
14 mm a los costados, y los gráficos de fondo activados.

**4. Limpiar.**

```
npm uninstall playwright
```

Y borrar `docs/manual/capturas`, que no va al repositorio.

## Al editar el texto

Los números que aparecen en el manual (cuántos materiales, cuántos equipos)
salen de la base el día que se escribió. Si pasó tiempo, conviene actualizarlos
o sacarlos: un número viejo presentado como actual hace dudar de todo el resto.
