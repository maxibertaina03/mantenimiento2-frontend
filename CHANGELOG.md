# Cambios

Lo que cambia en cada versión de las pantallas, escrito para quien usa el sistema. El formato
sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[versionado semántico](https://semver.org/lang/es/) (ver [CONTRIBUTING.md](CONTRIBUTING.md#las-versiones)).

## [1.19.0] — 2026-11-03

### Agregado

- **Órdenes de compra, filtros:** atajos de un toque (Falta precio, Sin factura, Atrasadas, Con problemas), combinables, y «Más filtros» con proveedor, fechas, precios y factura. El buscador también encuentra por material. Los filtros quedan en la dirección: volver de una orden deja la lista como estaba.

## [1.18.0] — 2026-11-03

### Agregado

- **Devolver al proveedor:** en una orden recibida, «Devolver al proveedor» registra lo que se
  devuelve (todo o una parte) con su nota de crédito. Lo devuelto sale del pañol, salvo lo que
  ya se usó. La nota de crédito se puede leer como una factura para completar cantidades y
  precios, y queda adjunta como comprobante «Nota de crédito». La orden queda «Devuelta» o
  «Devuelta en parte», con la pestaña Devoluciones.
- **Informes:** el gasto de compras descuenta lo devuelto, con una tarjeta «Devuelto».
- **Pedido de factura digital:** el PDF de la orden, el correo y el WhatsApp le piden al
  proveedor la factura en formato digital a Administración (administracion@lacteoslastres.com.ar,
  tel. 3534 40-3519).

## [1.17.0] — 2026-11-02

### Agregado

- **Gasto por material** en Informes → Compras: lo que se compró de cada material en el
  período, con la cantidad, el precio promedio, el último precio, lo gastado y a qué
  proveedores. Se busca por nombre y se exporta a PDF o planilla eligiendo columnas.

### Arreglado

- Precios desde la factura: lee mejor las facturas reales. Las fotos se preparan antes del
  OCR (más grandes, en gris y con contraste) y los renglones salen enteros aunque la foto esté
  un poco torcida. En los PDF, el importe se encuentra aunque después vengan el IVA y el total
  del renglón, y la hoja «Duplicado» no repite renglones. Ahora solo viene tildado lo que se
  parece y cuyos números cierran en la factura.

## [1.16.0] — 2026-11-02

### Agregado

- **Precios desde la factura:** en el detalle de la orden de compra, «Desde la factura» lee la
  factura del proveedor (una adjuntada, o se sube en el momento, en PDF o foto) y propone el
  precio de cada renglón. El nombre del proveedor no coincide con el nuestro, así que el
  sistema relaciona por parecido y se revisa antes de guardar: lo seguro viene tildado, lo
  dudoso no. Se guarda el precio sin IVA, y lo confirmado se aprende para la próxima factura de
  ese proveedor. Sin IA ni servicios pagos: la factura se lee en la misma computadora.

## [1.15.1] — 2026-11-02

### Cambiado (para quien desarrolla)

- La v1.15.0 no llegó a la web: Vercel la bloqueó mientras el repo era privado. Esta versión
  la publica, y `CLAUDE.md` deja anotado por qué el repo de las pantallas tiene que ser público.

## [1.15.0] — 2026-11-02

### Agregado

- **Informes** (menú Informes): lo que pasó en un período, con tarjetas de números, gráficos y
  tablas. Se elige el período (esta semana, este mes, el mes pasado, tres meses, el año o dos
  fechas) y si se agrupa por día, semana o mes. Cuatro pestañas:
  - **Trabajos:** órdenes por tipo, preventivo, horas de parada y equipos y sectores con más
    órdenes;
  - **Compras:** órdenes emitidas, plata comprada, proveedores y días de entrega;
  - **Personal:** qué hizo cada uno y su cumplimiento de tareas (solo con el permiso «Ver los
    resultados de cada persona»);
  - **Pañol:** entradas y salidas, lo que más salió y lo que no se mueve.
  - «Imprimir» saca la pestaña con el membrete y el período; se puede guardar como PDF.
- **Mis resultados:** cada uno ve sus tareas, su cumplimiento y sus órdenes, sin permisos
  especiales. Acceso desde el menú y desde Hoy.
- **Elegir columnas al exportar:** Materiales, el historial de movimientos y el informe de la
  toma de inventario preguntan qué columnas llevar antes de bajar el PDF o la planilla. La
  próxima vez vienen marcadas las mismas.

## [1.14.1] — 2026-10-30

### Cambiado (para quien desarrolla)

- **Revisión automática de PRs con Claude:** cada PR hacia main recibe comentarios de Claude
  sobre los problemas que encuentra (`.github/workflows/revision-claude.yml`). No bloquea: el
  check obligatorio sigue siendo el CI, y no tiene acceso a la base ni a producción.
- `CLAUDE.md` con las reglas del proyecto, que la revisión tiene en cuenta.

## [1.14.0] — 2026-10-28

### Agregado

- **Contraseñas en la ficha del equipo:** en Equipos IT, la ficha de una PC (o de cualquier
  equipo) muestra todas sus contraseñas —por ejemplo, el inicio de sesión y el AnyDesk— con
  **«Ver»**, que queda registrado igual que en Contraseñas, y **«Agregar contraseña»**, que
  abre el formulario con el equipo ya elegido.

### Documentación

- Manual: las contraseñas en la ficha del equipo, y portada con las versiones nuevas.

## [1.13.0] — 2026-10-27

### Agregado

- **Tareas en dos toques, desde el celular.** «Hecha» abre una hoja con la máquina en grande y
  el botón **«Hecha, sin novedad»**: un toque y queda hecha, y aparece la siguiente pendiente
  («Tarea 2 de 7»). Si hubo algo, **«Hubo algo / usé materiales»** abre el formulario de
  siempre. También se puede saltear o postergar.
- **«Todas hechas, sin novedad»** en el renglón de las tareas de todos los días: con una
  confirmación, las cierra juntas y avisa si alguna no se pudo.
- El calendario y Servicios usan la misma hoja.
- **Contraseñas:** se pueden agregar **tipos** nuevos desde el formulario («+ Agregar tipo…»).

### Cambiado

- **Contraseñas, más clara:** cada una en una tarjeta con sus notas a la vista y el enlace de
  dónde se usa. «Ver» y «Cambiar» quedan a mano; lo demás, en «Más». Al ver una, el usuario y
  dónde se usa ya no se pisan.

### Arreglado

- **Contraseñas: no se podía elegir el equipo.** La lista de equipos de informática salía vacía;
  ahora el equipo se busca escribiendo su nombre, en el formulario y en el filtro.

### Documentación

- Manual: «Dar por hechas las tareas, en dos toques», tipos y equipo en Contraseñas, y portada con las versiones nuevas.


## [1.12.2] — 2026-10-27

### Arreglado

- **«Imprimir orden» no respondía** si se había publicado una versión nueva con la página abierta.
  Ahora la página se recarga sola en ese caso, y si el PDF no se puede armar, el botón lo dice.
- **Campos angostos:** al agregar una marca o un modelo nuevo desde la ficha del equipo, el campo
  quedaba de dos letras de ancho; ahora ocupa toda la columna. En la orden de compra, «Qué es» ya
  no corta «Herramienta».

## [1.12.1] — 2026-10-26

### Documentación

- Manual: portada con las versiones nuevas (pantallas v1.12.0 · servidor v1.11.0).

## [1.12.0] — 2026-10-26

### Agregado

- **Sectores** (menú Mantenimiento): una tarjeta por sector de la planta con sus trabajos, los de
  sus máquinas, las horas de parada del año y el último trabajo.
- **El sector:** «Registrar trabajo» (el mismo formulario de la ficha de una máquina, con
  materiales y horas de parada), los totales del sector y de sus máquinas por separado, y
  pestañas con sus trabajos, los de sus máquinas y la lista de máquinas.
- **Nueva orden de trabajo:** «¿Sobre qué es?» (una máquina, un sector o no se dice).
- El listado de órdenes filtra por sector y muestra «Sobre qué»; el detalle, el PDF y el
  mensaje al taller dicen el sector.

### Documentación

- Manual: la sección Sectores y la orden sobre un sector.

## [1.11.1] — 2026-10-26

### Documentación

- Manual: el rol Encargado de planta, la versión al pie del menú y capturas al día.

## [1.11.0] — 2026-10-26

### Agregado

- **Rol Encargado de planta** en Usuarios y en Permisos, con su descripción.

## [1.10.0] — 2026-10-23

### Agregado

- **La versión al pie del menú:** «Pantallas v1.10.0 · Servidor v1.9.0». Sirve para decir con qué
  versión pasó algo, y para comprobar que una publicación ya llegó (si sigue la vieja, alcanza
  con recargar la página).

## [1.9.1] — 2026-10-23

### Documentación

- **Manual de usuario reescrito** con todas las pantallas actuales, incluidas la toma de
  inventario (con «En cero» y reubicar), pendientes y el calendario con sus pestañas.
- Las capturas del manual se sacan con el Chrome instalado, sin instalar Playwright.
- README: suma la toma de inventario.

## [1.9.0] — 2026-10-23

### Agregado

- **Toma de inventario: pestaña «En cero».** Lo que figura en 0 y no se contó sale de «Por
  contar» (que avisa cuántos hay) y va a su propia pestaña. Se mira el estante: al que tiene algo
  se le escribe la cantidad; el resto se confirma junto con «Confirmar que están en 0», que
  pregunta antes y queda a nombre de quien confirma. La planilla impresa los deja al final,
  aparte.

## [1.8.0] — 2026-10-22

### Agregado

- **Reubicar materiales desde la toma de inventario.** En cada material de una toma abierta,
  «Reubicar» deja elegir la estantería y la fila donde está de verdad: queda así en todo el
  sistema. Al final de la toma se listan los reubicados, y el informe PDF suma la tabla
  «Reubicados durante la toma» (de dónde a dónde, quién y cuándo).

## [1.7.1] — 2026-10-22

### Documentación

- **Manual:** sección nueva «Calendario y pendientes» (las dos pestañas, primero el equipo, el
  anotador y cómo se da por hecho un pendiente), con sus capturas en `capturar.mjs`.
- **README:** Hoy, Calendario y Pendientes al día.

## [1.7.0] — 2026-10-22

### Agregado

- **Pendientes**, en el menú de Mantenimiento: un anotador compartido para lo que quedó por
  hacer («comprar rulemanes», «mandar a reparar la válvula»). Se escribe y Enter; si hace
  falta, urgente, a quién le toca y el equipo. Filtros Todos · Míos · Urgentes, y los hechos de
  los últimos 60 días con la opción de reabrirlos.
  - Tocar el círculo **pregunta antes** («¿Ya está hecho?»).
  - Si le toca a alguien, solo esa persona (o un administrador) lo da por hecho.
  - Si es sobre un equipo, **«Registrar el trabajo»** abre el formulario de la ficha con el
    texto ya puesto, y queda la orden de trabajo realizada, que se abre desde «Hechos». También
    se puede cerrar sin orden.
- **Tarjeta «Pendientes» en Hoy**, con cuántos hay y cuántos son urgentes.

### Cambiado

- **Calendario: primero el equipo, abajo la tarea** («Compresor 1» y debajo «Purga de agua»),
  en el calendario y en Hoy.
- **Lo de todos los días va aparte:** el calendario tiene dos pestañas, «Services y tareas» y
  «Todos los días», y en Hoy las diarias van juntas en un renglón que se despliega.

### Arreglado

- En pantallas anchas, el fondo gris de las ventanas cubre toda la pantalla (quedaba una franja
  blanca a la derecha).

## [1.6.1] — 2026-10-20

### Arreglado

- **En el celular, las ventanas largas ya no se cortan.** Registrar un trabajo, una orden de
  compra, un equipo o un plan: los botones del final quedan pegados abajo y siempre a la vista.
  Los botones de texto largo bajan de renglón y el teclado ya no tapa el campo.
- Las tarjetas de números (como las cinco de Equipos) van en una fila que se desliza.

## [1.6.0] — 2026-10-20

### Cambiado

- **Diseño nuevo en todo el sistema.** Tipografía Inter, una sola paleta de colores y tamaños,
  íconos parejos en lugar de emojis, y botones, tablas, campos y ventanas más prolijos.
- **Menú agrupado por área** (Pañol, Mantenimiento, Compras, Informática, Administración), con
  íconos y fijo mientras se baja por la página.
- **Hoy:** la fecha bajo el título, tarjetas con ícono y color según urgencia, y las tareas con
  la fecha en un cuadradito (rojo si ya venció).
- **Materiales:** la cabecera con menús «Exportar» y «Configurar» (eran siete botones), la foto
  o un recuadro y la ubicación bajo el nombre, y el estado con un punto de color.
- **Registrar movimiento:** el tipo se elige con tres botones de color (Entrada, Salida,
  Ajuste) y los motivos tienen nombres legibles («Uso en un trabajo»), también en el historial.
- Las fechas se muestran «16/10/2026 10:26» y ya no se parten en las tablas.

### Agregado

- **En el celular, una barra fija abajo** con Hoy, Materiales, Cargar, Calendario y «Más».
  Las ventanas salen desde abajo a lo ancho, los filtros van compactos y cada lista se ve como
  tarjetas con su título.

## [1.5.1] — 2026-10-20

### Cambiado (para quien desarrolla)

- **npm fijado en 11.19 o más nuevo** (`engines` + `.npmrc` con `engine-strict`), y
  `packageManager: npm@11.19.1`. Con un npm más viejo el `package-lock.json` sale distinto al
  que espera el CI y `npm ci` falla en GitHub; ahora npm se niega a instalar y dice qué
  versión hace falta.
- El CI pasa a Node 24, la misma que usa Vercel para publicar (antes 22).

## [1.5.0] — 2026-10-19

### Seguridad

- Sin vulnerabilidades conocidas en lo que llega al navegador. Se actualizaron la librería
  que arma los PDF (jsPDF 4) con su componente de tablas, y la navegación (React Router 7).
  Los PDF salen idénticos a los de antes: órdenes de compra y de trabajo, planilla e informe
  de la toma y los listados se compararon uno por uno.

## [1.4.1] — 2026-10-19

### Seguridad

- React Router al día dentro de su versión (6.30.6). No cambia nada en las pantallas.

## [1.4.0] — 2026-10-19

### Agregado

- **Foto del material.** En la ficha de cada material se puede subir una foto desde el celular
  o la computadora (se achica sola), para reconocer en el estante los repuestos que se
  confunden. En la lista de materiales aparece una miniatura al lado del nombre.
- **Último inventario.** La ficha del material dice cuándo se lo contó por última vez, hace
  cuántos días, en qué toma (con el enlace) y cuánto se contó contra lo que figuraba. Si nunca
  se contó, lo dice.

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

[1.19.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.19.0
[1.18.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.18.0
[1.17.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.17.0
[1.16.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.16.0
[1.15.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.15.1
[1.15.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.15.0
[1.14.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.14.1
[1.14.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.14.0
[1.13.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.13.0
[1.12.2]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.12.2
[1.12.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.12.1
[1.12.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.12.0
[1.11.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.11.1
[1.11.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.11.0
[1.10.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.10.0
[1.9.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.9.1
[1.9.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.9.0
[1.8.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.8.0
[1.7.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.7.1
[1.7.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.7.0
[1.6.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.6.1
[1.6.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.6.0
[1.5.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.5.1
[1.5.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.5.0
[1.4.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.4.1
[1.4.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.4.0
[1.3.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.3.1
[1.3.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.3.0
[1.2.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.2.0
[1.1.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.1.0
[1.0.1]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.0.1
[1.0.0]: https://github.com/maxibertaina03/mantenimiento2-frontend/releases/tag/v1.0.0
