import { useVersionServidor } from '@/api/sistema';

/** La versión de las pantallas, la de `package.json`, puesta al compilar. */
export const VERSION_PANTALLAS = __VERSION_PANTALLAS__;

/**
 * Al pie del menú: qué versión de las pantallas y del servidor está usando
 * cada uno.
 *
 * Sirve para dos cosas. Si alguien avisa que algo no anda, se sabe con qué
 * versión le pasó. Y después de publicar, se ve si la versión nueva ya llegó:
 * si sigue la vieja, el navegador tiene guardada la página anterior y alcanza
 * con recargar.
 */
export function VersionSistema() {
  const { data } = useVersionServidor();
  return (
    <p
      className="version-sistema"
      title={data ? `Servidor ${data.version}+${data.commit}` : undefined}
    >
      Pantallas v{VERSION_PANTALLAS}
      {data && <> · Servidor v{data.version}</>}
    </p>
  );
}
