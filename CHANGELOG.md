# Cambios

Lo que cambia en cada versión de las pantallas, escrito para quien usa el sistema. El formato
sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[versionado semántico](https://semver.org/lang/es/) (ver [CONTRIBUTING.md](CONTRIBUTING.md#las-versiones)).

## [1.3.1] — 2026-10-16

### Cambiado

- La toma de inventario aparece y se usa según sus permisos propios (ver, contar y ajustar),
  que se reparten desde la pantalla Permisos.

## [1.3.0] — 2026-10-16

### Agregado

- **Toma de inventario** (menú «Toma de inventario»). Se abre una toma sobre una categoría,
  una estantería o todo el pañol y se cuenta material por material, desde el celular o con la
  planilla impresa. Mientras se cuenta no se muestra cuánto figura: se escribe lo que se ve.
  Escanear el QR de un material lo trae directo. Antes de confirmar se ven las diferencias, y al
  confirmar se ajusta el stock. Lo que se movió después de contarlo queda para volver a contar.
  Se puede contar por tandas y cerrar la toma cuando se termina. Informe en PDF.

## [1.2.0] — 2026-10-15

### Agregado

- **Respetar el calendario:** al crear o editar un plan de mantenimiento se elige cómo se cuenta
  el próximo service si se hace tarde: desde que se hizo (como siempre) o respetando las fechas
  planificadas. La ficha del equipo muestra cuál usa cada plan.
- **Postergar** en Hoy, en el calendario y en Servicios: para las tareas que todavía no
  vencieron, a otro día y con el motivo. Si se pasa del límite (la vez siguiente que toca), la
  pantalla lo explica. La tarea y el service muestran de qué día se postergaron, quién y por qué.

## [1.1.0] — 2026-10-15

### Cambiado

- **Materiales y Equipos recuerdan dónde estabas.** El filtro, la búsqueda y la página quedan
  en la dirección: entrar a un material (o a un equipo) y volver deja la lista igual, por
  ejemplo «Electricidad», página 4. También vale el botón «atrás» del navegador, y el enlace a
  una lista filtrada se puede compartir.

### Arreglado

- El enlace de «Hoy» a los equipos parados (`/equipos?estado=…`) ahora sí filtra la lista.

## [1.0.1] — 2026-10-14

### Agregado

- Página pública de privacidad (`/privacidad.html`), que pide Google para publicar la app con
  la que se suben los backups cifrados a Drive.

## [1.0.0] — 2026-10-14

Primera versión numerada: es el sistema tal como está en producción desde junio de 2026, con
todo lo que se le fue sumando. A partir de acá, cada publicación tiene su número y su entrada.

### Qué incluye

- **Hoy:** las tareas de cada uno y una tarjeta por cada cosa pendiente (equipos parados,
  services, talleres externos, reponer, mercadería por llegar, órdenes sin enviar).
- **Pañol:** materiales, historial de movimientos y carga de entradas y salidas, también con
  lector de QR.
- **Calendario:** tareas por persona y rutinas; impresión por semana o por mes.
- **Órdenes de trabajo:** detalle con encabezado y pestañas; mandar a un taller de afuera,
  mandarle la orden y registrar la vuelta.
- **Órdenes de compra:** detalle con encabezado y pestañas; envío por correo o WhatsApp;
  recepción en partes (cada renglón arranca en 0), reclamo y cierre con faltante; PDF.
- **Equipos y servicios:** ficha de cada máquina con fotos, manuales, repuestos, componentes,
  planes, QR y modo rápido al escanear.
- **Equipos IT y contraseñas.**
- **Modales** que preguntan antes de cerrarse si hay algo cargado.
- Funciona en la computadora y en el celular.

[1.3.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.3.1
[1.3.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.3.0
[1.2.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.2.0
[1.1.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.1.0
[1.0.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.0.1
[1.0.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.0.0
