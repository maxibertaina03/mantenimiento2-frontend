import { Eye, Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useCredenciales, type Credencial } from '@/api/credenciales';
import { formatearFechaSola } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { VerSecreto } from './AccionesCredencial';
import { Cargando, MensajeError } from './Estados';
import { FormularioCredencial } from './FormularioCredencial';

/**
 * Las credenciales que pertenecen a un equipo de informática, en su ficha.
 *
 * Es el lado que hace que atarlas sirva. Alguien que está frente a una PC que
 * no arranca no va a ir a buscar su clave a otro módulo filtrando por equipo:
 * la busca donde está la máquina. Acá la encuentra, y la puede ver o cargar
 * una nueva sin salir de la ficha. Un equipo puede tener varias: el inicio de
 * sesión de la PC y su AnyDesk, por ejemplo.
 *
 * Ver una contraseña acá es el mismo pedido que desde Contraseñas, y queda
 * registrado igual: quién la miró y cuándo.
 */
export function CredencialesDelEquipo({
  equipoItId,
  equipoNombre,
}: {
  equipoItId: string;
  /** Para que una contraseña nueva arranque con este equipo elegido. */
  equipoNombre: string;
}) {
  const puede = usePuede();
  // Sin permiso no se pide. Un hook no se puede llamar condicionalmente, así
  // que la consulta se apaga con `enabled`: si no, esta sección saldría a pedir
  // credenciales igual y se comería un 403 que se ve como un error rojo.
  const habilitado = puede(P.CREDENCIALES_VER);
  const puedeVer = puede(P.CREDENCIALES_REVELAR);
  const puedeCargar = puede(P.CREDENCIALES_EDITAR);
  const { data, isLoading, error } = useCredenciales(1, 50, { equipoItId }, habilitado);
  const [viendo, setViendo] = useState<Credencial | null>(null);
  const [cargando, setCargando] = useState(false);

  if (!habilitado) return null;

  const credenciales = data?.datos ?? [];

  return (
    <>
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">
          <Lock className="icono" aria-hidden /> Contraseñas de este equipo
          {credenciales.length > 0 && <span className="badge">{credenciales.length}</span>}
        </h3>
        {puedeCargar && (
          <button type="button" className="btn btn-chico" onClick={() => setCargando(true)}>
            <Plus className="icono" aria-hidden />
            Agregar contraseña
          </button>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && credenciales.length === 0 && (
        <p className="texto-suave texto-chico">Este equipo no tiene ninguna contraseña cargada.</p>
      )}

      {credenciales.length > 0 && (
        <ul className="lista-simple lista-credenciales-equipo">
          {credenciales.map((c) => (
            <li key={c.id}>
              <span className="credencial-equipo-que">
                <strong>{c.nombre}</strong>
                <span className="texto-suave texto-chico">
                  {[c.tipoNombre, c.usuario].filter(Boolean).join(' · ')}
                </span>
                {c.proximaRotacion && (
                  <span className="texto-suave texto-chico">
                    Hay que cambiarla el {formatearFechaSola(c.proximaRotacion)}
                  </span>
                )}
              </span>
              {puedeVer && (
                <button
                  type="button"
                  className="btn btn-sm btn-primario"
                  aria-label={`Ver la contraseña de ${c.nombre}`}
                  onClick={() => setViendo(c)}
                >
                  <Eye className="icono" aria-hidden />
                  Ver
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {viendo && <VerSecreto credencial={viendo} onCerrar={() => setViendo(null)} />}
      {cargando && (
        <FormularioCredencial
          equipoInicial={{ id: equipoItId, nombre: equipoNombre }}
          onCerrar={() => setCargando(false)}
        />
      )}
    </>
  );
}
