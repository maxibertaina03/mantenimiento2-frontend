import { useState } from 'react';
import { useActualizarUsuario, useUsuarioActual, useUsuarios } from '@/api/usuarios';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFecha } from '@/lib/formato';
import type { RolUsuario } from '@/tipos/usuario';

/** Qué habilita cada rol, para que la elección no sea a ciegas. */
const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Accede a Equipos IT y puede corregir movimientos de cualquier usuario.',
  OPERARIO: 'Uso normal del sistema. Solo puede corregir los movimientos que cargó.',
};

export function UsuariosPage() {
  const { data, isLoading, error } = useUsuarios(1, 100);
  const { data: yo } = useUsuarioActual();
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
          'Vas a perder el acceso a Equipos IT y a esta pantalla.',
          'Solo otro administrador va a poder devolvértelo.',
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
        <div className="tabla-scroll">
          <table className="tabla">
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
                  <td>
                    <strong>{u.nombre}</strong>
                    {u.id === yo?.id && <span className="badge badge-ok">Vos</span>}
                    {!u.idExterno && (
                      <div className="texto-suave texto-chico">Sin acceso al sistema</div>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td className="texto-suave">{formatearFecha(u.creadoEn)}</td>
                  <td>
                    <select
                      value={u.rol}
                      disabled={guardando === u.id}
                      onChange={(e) => cambiarRol(u.id, e.target.value as RolUsuario, u.nombre)}
                      aria-label={`Rol de ${u.nombre}`}
                    >
                      <option value="OPERARIO">Operario</option>
                      <option value="ADMIN">Administrador</option>
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
        <div className="grilla-datos">
          {(Object.keys(DESCRIPCION_ROL) as RolUsuario[]).map((rol) => (
            <div className="dato" key={rol}>
              <span className="texto-suave texto-chico">
                {rol === 'ADMIN' ? 'Administrador' : 'Operario'}
              </span>
              <span>{DESCRIPCION_ROL[rol]}</span>
            </div>
          ))}
        </div>
        <p className="texto-suave texto-chico" style={{ marginTop: '0.6rem' }}>
          El sistema no permite quedarse sin ningún administrador: antes de quitarle el rol al
          último, hay que nombrar a otro.
        </p>
      </div>
    </>
  );
}
