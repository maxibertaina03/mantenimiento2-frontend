import { useState } from 'react';
import { useActualizarUsuario, useUsuarioActual, useUsuarios } from '@/api/usuarios';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFecha } from '@/lib/formato';
import type { RolUsuario } from '@/tipos/usuario';
import { ROLES, usePermisosPorRol } from '@/api/permisos';
import { P, usePuede } from '@/lib/permisos';

/**
 * Los roles salen de la lista compartida, no de una copia escrita acá.
 *
 * Esta pantalla ofrecía dos roles cuando el sistema ya tenía cuatro, y elegir
 * "Operario" terminaba en un error del servidor que no explicaba nada.
 */
const ETIQUETA_ROL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.rol, r.etiqueta]),
);

export function UsuariosPage() {
  const { data, isLoading, error } = useUsuarios(1, 100);
  const { data: yo } = useUsuarioActual();
  // Solo se pide si quien mira puede administrar permisos: es un numero al
  // lado de cada rol, no vale un 403 de fondo.
  const puede = usePuede();
  const permisosPorRol = usePermisosPorRol(puede(P.PERMISOS_ADMINISTRAR));
  const actualizar = useActualizarUsuario();
  const [guardando, setGuardando] = useState<string | null>(null);

  const cambiarRol = async (id: string, rol: RolUsuario, nombre: string) => {
    // Bajarse el propio rol es la forma más fácil de perder el acceso sin
    // querer, así que se avisa antes.
    if (id === yo?.id && rol !== 'ADMIN') {
      const seguir = confirm(
        [
          `Te estás quitando el rol de administrador a vos mismo (${nombre}).`,
          '',
          `Vas a pasar a ${ETIQUETA_ROL[rol] ?? rol} y vas a perder el acceso a esta pantalla`,
          'y a la de permisos. Solo otro administrador va a poder devolvértelo.',
          '',
          '¿Continuar?',
        ].join('\n'),
      );
      if (!seguir) return;
    }

    setGuardando(id);
    try {
      await actualizar.mutateAsync({ id, rol });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Usuarios</h1>
          <p className="texto-suave">
            Los usuarios se crean solos la primera vez que alguien inicia sesión. Acá se
            define qué puede hacer cada uno.
          </p>
        </div>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {actualizar.error && <MensajeError error={actualizar.error} />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>Todavía no hay usuarios registrados.</EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Alta</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {data.datos.map((u) => (
                <tr key={u.id}>
                  <td data-etiqueta="Usuario">
                    <strong>{u.nombre}</strong>
                    {u.id === yo?.id && <span className="badge badge-ok">Vos</span>}
                    {!u.idExterno && (
                      <div className="texto-suave texto-chico">Sin acceso al sistema</div>
                    )}
                  </td>
                  <td data-etiqueta="Email">{u.email}</td>
                  <td className="texto-suave" data-etiqueta="Alta">{formatearFecha(u.creadoEn)}</td>
                  <td data-etiqueta="Rol">
                    <select
                      value={u.rol}
                      disabled={guardando === u.id}
                      onChange={(e) => cambiarRol(u.id, e.target.value as RolUsuario, u.nombre)}
                      aria-label={`Rol de ${u.nombre}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.rol} value={r.rol}>
                          {r.etiqueta}
                        </option>
                      ))}
                    </select>
                    {guardando === u.id && (
                      <span className="texto-suave texto-chico"> guardando…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h3 className="subtitulo-form">Qué puede hacer cada rol</h3>
        <ul className="lista-catalogo">
          {ROLES.map((r) => (
            <li key={r.rol}>
              <span>
                <strong>{r.etiqueta}</strong>
                <div className="texto-suave texto-chico">{r.descripcion}</div>
              </span>
              <span className="texto-suave texto-chico">
                {permisosPorRol.data
                  ? `${permisosPorRol.data[r.rol]?.length ?? 0} permiso(s)`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="texto-suave texto-chico" style={{ marginTop: '0.6rem' }}>
          Lo que puede hacer cada rol se define en <strong>Permisos</strong>, y se aplica en el
          momento. El sistema no permite quedarse sin ningún administrador: antes de quitarle el
          rol al último, hay que nombrar a otro.
        </p>
      </div>
    </>
  );
}
