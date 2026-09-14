import { useState } from 'react';
import {
  useActualizarResponsable,
  useCrearResponsable,
  useEliminarResponsable,
  useResponsables,
  useUnificarResponsables,
  type Responsable,
} from '@/api/responsables';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

/** La clave con la que se comparan dos nombres: sin acentos ni mayúsculas. */
function clave(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Pares que PODRÍAN ser la misma persona cargada dos veces.
 *
 * Solo se marcan los casos en que un nombre completo es el principio del otro:
 * "Julieta" dentro de "Julieta Redolfi". Es deliberadamente conservador. En el
 * inventario real conviven "Jose ignacio Carassai" y "José Luis Carassai", que
 * son dos personas distintas, y cualquier regla más suelta las junta.
 *
 * Por eso esto solo SUGIERE. Quien sabe quién es quién es quien usa el sistema.
 */
export function paresSospechosos(responsables: Responsable[]): [Responsable, Responsable][] {
  const pares: [Responsable, Responsable][] = [];
  for (const a of responsables) {
    for (const b of responsables) {
      if (a.id >= b.id) continue;
      const ka = clave(a.nombre);
      const kb = clave(b.nombre);
      const corto = ka.length <= kb.length ? ka : kb;
      const largo = ka.length <= kb.length ? kb : ka;
      // Prefijo de palabra completa: "julieta" en "julieta redolfi" sí,
      // "jose" en "josefina" no.
      if (largo !== corto && largo.startsWith(corto + ' ')) {
        pares.push(ka.length <= kb.length ? [b, a] : [a, b]);
      }
    }
  }
  return pares;
}

/**
 * Las personas y sectores que tienen equipos de informática a cargo.
 *
 * No son usuarios del sistema, y esa es toda la razón por la que existen: antes
 * cada persona a la que se le asignaba una notebook entraba como usuario con un
 * correo inventado y un rol que nunca usaba.
 */
export function ResponsablesEquipo({ onCerrar }: { onCerrar: () => void }) {
  const { data, isLoading, error } = useResponsables(false);
  const crear = useCrearResponsable();
  const actualizar = useActualizarResponsable();
  const eliminar = useEliminarResponsable();
  const unificar = useUnificarResponsables();

  const [nombre, setNombre] = useState('');
  const [sector, setSector] = useState('');

  const responsables = data ?? [];
  const sospechosos = paresSospechosos(responsables.filter((r) => r.activo));

  const agregar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    await crear.mutateAsync({ nombre: limpio, sector: sector.trim() || undefined });
    setNombre('');
    setSector('');
  };

  const juntar = async (queda: Responsable, seAbsorbe: Responsable) => {
    if (
      !confirm(
        `¿"${seAbsorbe.nombre}" es la misma persona que "${queda.nombre}"?\n\n` +
          `Sus ${seAbsorbe.equipos} equipo(s) y su historial pasan a "${queda.nombre}", y ` +
          `"${seAbsorbe.nombre}" queda desactivado. No se borra: si te equivocaste, se puede reactivar.`,
      )
    )
      return;
    await unificar.mutateAsync({ queda: queda.id, seAbsorbe: seAbsorbe.id });
  };

  const borrar = async (r: Responsable) => {
    if (!confirm(`¿Eliminar a "${r.nombre}"?`)) return;
    await eliminar.mutateAsync(r.id);
  };

  return (
    <Modal titulo="Responsables de equipos" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          Quién tiene cada equipo de informática. <strong>No son usuarios del sistema</strong>: no
          tienen clave ni entran a ningún lado. Puede ser una persona, o un sector entero.
        </p>

        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="resp-nombre">Nombre</label>
            <input
              id="resp-nombre"
              value={nombre}
              placeholder="Julieta Redolfi, Operarios de expedición…"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void agregar();
                }
              }}
            />
          </div>
          <div className="campo">
            <label htmlFor="resp-sector">Sector (opcional)</label>
            <input
              id="resp-sector"
              value={sector}
              placeholder="Administración"
              onChange={(e) => setSector(e.target.value)}
            />
          </div>
          <div className="campo" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primario"
              onClick={agregar}
              disabled={!nombre.trim() || crear.isPending}
            >
              {crear.isPending ? 'Agregando…' : '+ Agregar'}
            </button>
          </div>
        </div>

        {crear.error && <MensajeError error={crear.error} />}
        {eliminar.error && <MensajeError error={eliminar.error} />}
        {unificar.error && <MensajeError error={unificar.error} />}

        {sospechosos.length > 0 && (
          <div className="alerta alerta-aviso">
            <strong>Puede que alguno esté cargado dos veces.</strong> La importación original tomó
            los nombres como venían en la planilla. Revisá estos casos: si son la misma persona,
            juntalos; si no, dejalos como están.
            <ul className="lista-catalogo" style={{ marginTop: '0.6rem' }}>
              {sospechosos.map(([largo, corto]) => (
                <li key={`${largo.id}-${corto.id}`}>
                  <span>
                    <strong>{corto.nombre}</strong> ({corto.equipos} equipo(s)) y{' '}
                    <strong>{largo.nombre}</strong> ({largo.equipos} equipo(s))
                  </span>
                  <span className="acciones-catalogo">
                    <button
                      className="btn btn-sm"
                      disabled={unificar.isPending}
                      onClick={() => juntar(largo, corto)}
                    >
                      Son la misma: dejar «{largo.nombre}»
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {data && responsables.length === 0 && (
          <EstadoVacio>Todavía no hay ningún responsable cargado.</EstadoVacio>
        )}

        {responsables.length > 0 && (
          <ul className="lista-catalogo">
            {responsables.map((r) => (
              <li key={r.id} className={r.activo ? undefined : 'inactivo'}>
                <span>
                  {r.nombre}
                  {r.sector && <span className="texto-suave texto-chico"> · {r.sector}</span>}
                  {!r.activo && <span className="texto-suave texto-chico"> · desactivado</span>}
                </span>
                <span className="acciones-catalogo">
                  <span className="texto-suave texto-chico">
                    {r.equipos === 0 ? 'sin equipos' : `${r.equipos} equipo(s)`}
                  </span>
                  <button
                    className="btn btn-sm"
                    onClick={() => actualizar.mutate({ id: r.id, activo: !r.activo })}
                  >
                    {r.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  {/* Solo se borra al que nunca tuvo nada. Si figura en el
                      historial, borrarlo dejaría tramos sin decir quién tenía
                      el equipo; lo correcto es desactivarlo. */}
                  {r.equipos === 0 && r.asignaciones === 0 && (
                    <button className="btn btn-sm" onClick={() => borrar(r)}>
                      Eliminar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
