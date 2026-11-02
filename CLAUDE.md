# Instrucciones para Claude

Pantallas del sistema de mantenimiento de una planta láctea. React 18 + TypeScript +
Vite + React Query, desplegado en Vercel. La API es `mantenimiento2-backend`. Lo usan
operarios desde el celular y la tablet, y la oficina desde la computadora.

## Idioma

Todo en español, con voseo: respuestas, comentarios de revisión, textos de pantalla,
código, commits y documentación (el manual está en `docs/manual`).

## Reglas

- Ningún secreto ni dato real en el repo: es público.
- Y tiene que seguir público: Vercel (plan Hobby) bloquea la publicación de un repo
  privado cuando los commits tienen coautores. Si se vuelve privado, la web deja de
  actualizarse sin ningún error en el CI.
- Commits `tipo(ámbito): título` de hasta 72 caracteres
  (`node scripts/verificar-commits.mjs`). A main solo se llega por PR desde develop.
- Colores, tamaños y radios salen de las variables de `src/index.css`; íconos de
  `lucide-react` con la clase `icono`, nunca emojis.
- Reusar los componentes que ya existen (`Modal`, `SelectConAlta`, `ComboEquipo`,
  `ComboEquipoIt`, `MenuDesplegable`) antes de crear otros.
- Que funcione en el celular: botones fáciles de tocar y sin scroll horizontal.

## Verificar un cambio

`npm run build`, `npm test` (vitest) y `npm run lint`.

## Al revisar un PR

Importan sobre todo: pantallas que se rompen o quedan vacías ante un error de la API,
permisos (un botón que aparece para quien no puede usarlo), contraseñas que se muestran
sin pasar por el pedido registrado, y lo que deje de funcionar en el celular.
