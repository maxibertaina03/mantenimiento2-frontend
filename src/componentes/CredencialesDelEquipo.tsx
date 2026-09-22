import { useCredenciales } from '@/api/credenciales';
import { formatearFechaSola } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { Cargando, MensajeError } from './Estados';

/**
 * Las credenciales que pertenecen a un equipo de informática, en su ficha.
 *
 * Es el lado que hace que atarlas sirva. Alguien que está frente a una PC que
 * no arranca no va a ir a buscar su clave a otro módulo filtrando por equipo:
 * la busca donde está la máquina. Acá la encuentra.
 *
 * Muestra los nombres, no los valores. Ver una contraseña sigue siendo un
 * pedido aparte desde el baúl, que queda registrado con quién la miró. Si esta
 * sección las revelara, ese registro dejaría de valer para nada.
 */
export function CredencialesDelEquipo({ equipoItId }: { equipoItId: string }) {
  const puede = usePuede();
  // Sin permiso no se pide. Un hook no se puede llamar condicionalmente, así
  // que la consulta se apaga con `enabled`: si no, esta sección saldría a pedir
  // credenciales igual y se comería un 403 que se ve como un error rojo.
  const habilitado = puede(P.CREDENCIALES_VER);
  const { data, isLoading, error } = useCredenciales(1, 50, { equipoItId }, habilitado);

  if (!habilitado) return null;

  const credenciales = data?.datos ?? [];

  return (
    <>
      <h3 className="subtitulo-form">🔐 Contraseñas de este equipo</h3>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && credenciales.length === 0 && (
        <p className="texto-suave texto-chico">
          Este equipo no tiene ninguna contraseña cargada. Se cargan desde Contraseñas, eligiéndolo
          en «Equipo de informatica».
        </p>
      )}

      {credenciales.length > 0 && (
        <>
          <ul className="lista-simple">
            {credenciales.map((c) => (
              <li key={c.id}>
                <strong>{c.nombre}</strong>
                {c.usuario && <span className="texto-suave"> · {c.usuario}</span>}
                {c.proximaRotacion && (
                  <div className="texto-suave texto-chico">
                    Hay que cambiarla el {formatearFechaSola(c.proximaRotacion)}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="texto-suave texto-chico">
            Para ver una contraseña hay que pedirla desde Contraseñas, y ese pedido queda
            registrado.
          </p>
        </>
      )}
    </>
  );
}
