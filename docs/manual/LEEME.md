# Manual del sistema

El manual en PDF que se le entrega a la gente que usa el sistema. Acá está lo que
hace falta para volver a generarlo cuando las pantallas cambien.

Las capturas **no** se versionan. Son varios MB que quedan viejos a la primera
pantalla que se toque, y una imagen desactualizada en un manual es peor que no
tener manual: enseña algo que ya no es. Se vuelven a sacar cada vez.

## Qué hay acá

| Archivo | Qué es |
| --- | --- |
| `manual.html` | El texto del manual y su diseño. Es lo que se edita. |
| `capturar.mjs` | Saca las capturas del sistema andando, con el Chrome instalado. |

## Cuándo actualizarlo

Cada vez que se agrega una pantalla o cambia cómo se usa una. Al editar
`manual.html`, actualizar también la portada: el mes y las versiones de las
pantallas y del servidor que describe.

## Cómo se regenera

Hace falta Chrome (o Edge) instalado. No hay que instalar nada más.

**1. Traer los datos de verdad y levantar el sistema en local.**

En `mantenimiento2-backend` (ver `docs/como-probar.md`):

```
npm run local:copiar-produccion
npm run build
npx dotenv -e .env -- node dist/main.js
```

El `.env` local tiene que tener `AUTH_DISABLED=true`: el manual muestra la vista
del administrador, sin login.

Acá, con `VITE_API_URL=http://localhost:3000/api` y sin
`VITE_CLERK_PUBLISHABLE_KEY` en el `.env.local`:

```
npm run build
npx vite preview --port 4173
```

**2. Sacar las capturas.**

```
node docs/manual/capturar.mjs docs/manual/capturas http://localhost:4173
```

El script solo navega y abre fichas y ventanas. No envía ningún formulario, así
que no crea ni modifica un solo dato. Al final dice cuáles salieron bien. Conviene
mirar las que abren algo (una ficha, una orden): si una pantalla cambió, el clic
que la abre puede no encontrar el botón y la captura queda en la lista.

**3. Armar el PDF.**

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --no-pdf-header-footer ^
  --print-to-pdf="Manual del sistema de Mantenimiento.pdf" ^
  "file:///C:/ruta/a/mantenimiento2-frontend/docs/manual/manual.html"
```

O abrir `manual.html` en Chrome e imprimir a PDF, sin encabezados ni pies de
página y con los gráficos de fondo activados. Los márgenes ya los fija la página.

El PDF tampoco se versiona: tiene capturas con datos reales (nombres de
proveedores, de usuarios y de las credenciales guardadas) y el repositorio es
público. Se reparte por fuera.
