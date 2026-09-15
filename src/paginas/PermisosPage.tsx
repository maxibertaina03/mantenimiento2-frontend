import { useEffect, useMemo, useState } from 'react';
import {
  ROLES,
  useCatalogoPermisos,
  useGuardarPermisos,
  usePermisosPorRol,
  type Rol,
} from '@/api/permisos';
import { Cargando, MensajeError } from '@/componentes/Estados';

/**
 * Qué puede hacer cada rol.
 *
 * Los permisos existentes salen del servidor y no de una lista escrita acá:
 * así, si mañana aparece un permiso nuevo, aparece solo en esta pantalla en vez
 * de faltar hasta que alguien se acuerde de agregarlo de los dos lados.
 *
 * Importa entender qué NO hace esta pantalla: no esconde botones, reparte
 * permisos de verdad. Quien decide si una acción pasa es el servidor, y lo que
 * se marca acá es exactamente lo que el servidor va a exigir.
 */
export function PermisosPage() {
  const catalogo = useCatalogoPermisos();
  const porRol = usePermisosPorRol();
  const guardar = useGuardarPermisos();

  const [rol, setRol] = useState<Rol>('GERENCIA');
  const [marcados, setMarcados] = useState<Set<string> | null>(null);

  // Al cambiar de rol, se parte de lo que está guardado.
  useEffect(() => {
    if (porRol.data) setMarcados(new Set(porRol.data[rol] ?? []));
  }, [rol, porRol.data]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { permiso: string; etiqueta: string }[]>();
    for (const item of catalogo.data ?? []) {
      if (!mapa.has(item.grupo)) mapa.set(item.grupo, []);
      mapa.get(item.grupo)!.push({ permiso: item.permiso, etiqueta: item.etiqueta });
    }
    return [...mapa.entries()];
  }, [catalogo.data]);

  const guardados = porRol.data?.[rol] ?? [];
  const hayCambios =
    marcados !== null &&
    (marcados.size !== guardados.length || guardados.some((p) => !marcados.has(p)));

  const esAdmin = rol === 'ADMIN';
  const definicion = ROLES.find((r) => r.rol === rol);

  const alternar = (permiso: string) => {
    setMarcados((previos) => {
      const copia = new Set(previos ?? []);
      if (copia.has(permiso)) copia.delete(permiso);
      else copia.add(permiso);
      return copia;
    });
  };

  const aplicar = async () => {
    if (!marcados) return;
    await guardar.mutateAsync({ rol, permisos: [...marcados] });
  };

  if (catalogo.isLoading || porRol.isLoading) return <Cargando />;
  if (catalogo.error) return <MensajeError error={catalogo.error} />;
  if (porRol.error) return <MensajeError error={porRol.error} />;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Permisos</h1>
          <p className="texto-suave">Qué puede hacer cada rol. Se aplica en el momento.</p>
        </div>
      </div>

      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="rol">Rol</label>
          <select id="rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => (
              <option key={r.rol} value={r.rol}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {definicion && <p className="texto-suave texto-chico">{definicion.descripcion}</p>}

      {esAdmin && (
        <div className="alerta alerta-aviso">
          Al administrador no se le puede quitar <strong>Cambiar qué puede hacer cada rol</strong>.
          Si se pudiera, y sos el único administrador, el sistema quedaría sin nadie capaz de volver
          a habilitarlo y habría que arreglarlo por fuera.
        </div>
      )}

      {grupos.map(([grupo, items]) => (
        <section key={grupo} style={{ marginTop: '1.2rem' }}>
          <h3 className="subtitulo-form">{grupo}</h3>
          <ul className="lista-catalogo">
            {items.map((item) => {
              const bloqueado = esAdmin && item.permiso === 'permisos.administrar';
              return (
                <li key={item.permiso}>
                  <label className="filtro-check" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={marcados?.has(item.permiso) ?? false}
                      disabled={bloqueado}
                      onChange={() => alternar(item.permiso)}
                    />
                    {item.etiqueta}
                  </label>
                  <span className="texto-suave texto-chico">{item.permiso}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {guardar.error && <MensajeError error={guardar.error} />}

      <div className="acciones" style={{ position: 'sticky', bottom: 0, paddingTop: '0.8rem' }}>
        <span className="texto-suave">
          {marcados?.size ?? 0} permiso(s) marcado(s)
          {hayCambios ? ' · sin guardar' : ''}
        </span>
        <button
          className="btn"
          disabled={!hayCambios}
          onClick={() => setMarcados(new Set(guardados))}
        >
          Deshacer
        </button>
        <button
          className="btn btn-primario"
          disabled={!hayCambios || guardar.isPending}
          onClick={aplicar}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </>
  );
}
