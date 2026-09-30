import { useState } from 'react';
import {
  useComponentes,
  useDesmontarEquipo,
  useEquipo,
  useMontajes,
  useMontarEquipo,
} from '@/api/equipos';
import { formatearFechaSola } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_ESTADO_EQUIPO, type Equipo } from '@/tipos/equipo';
import { ComboEquipo } from './ComboEquipo';
import { Cargando, MensajeError } from './Estados';

type Elegido = { id: string; nombre: string } | null;

/**
 * Dónde está montado este equipo y qué tiene montado.
 *
 * La electrobomba va en la desnatadora: en la ficha de la bomba se ve «Montado
 * en: Desnatadora 1», y en la de la desnatadora, la bomba entre sus
 * componentes. Trasladar es montar en otra máquina: el tramo anterior se cierra
 * solo, y queda en «Por dónde pasó».
 *
 * `onAbrir` lleva a la ficha de otro equipo sin cerrar el módulo.
 */
export function ComponentesEquipo({
  equipo: inicial,
  onAbrir,
}: {
  equipo: Equipo;
  onAbrir: (equipoId: string) => void;
}) {
  const puede = usePuede();
  const puedeEditar = puede(P.EQUIPOS_EDITAR);

  // La ficha viene de la lista y puede estar vieja: después de montar hay que
  // mostrar lo nuevo, así que se lee la versión fresca.
  const fresco = useEquipo(inicial.id);
  const equipo = fresco.data ?? inicial;
  const dadoDeBaja = equipo.estado === 'DADO_DE_BAJA';

  const componentes = useComponentes(equipo.id);
  const [verTramos, setVerTramos] = useState(false);
  const tramos = useMontajes(equipo.id, verTramos);

  const montar = useMontarEquipo();
  const desmontar = useDesmontarEquipo();

  /** Qué formulario está abierto: montar este equipo en otro, sacarlo, o sumarle uno. */
  const [abierto, setAbierto] = useState<'montar' | 'desmontar' | 'agregar' | null>(null);
  const [elegido, setElegido] = useState<Elegido>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(null);
    setElegido(null);
    setMotivo('');
  };

  const intentar = async (accion: () => Promise<unknown>) => {
    setAviso(null);
    try {
      await accion();
      cerrar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    }
  };

  const confirmarMontaje = () =>
    elegido &&
    intentar(() =>
      montar.mutateAsync({ componenteId: equipo.id, equipoPadreId: elegido.id, motivo }),
    );

  const confirmarDesmontaje = () =>
    intentar(() => desmontar.mutateAsync({ componenteId: equipo.id, motivo }));

  const confirmarComponente = () =>
    elegido &&
    intentar(() =>
      montar.mutateAsync({ componenteId: elegido.id, equipoPadreId: equipo.id, motivo }),
    );

  const ocupado = montar.isPending || desmontar.isPending;
  const lista = componentes.data ?? [];

  return (
    <>
      {/* ── Dónde está montado ── */}
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">Dónde está montado</h3>
      </div>

      {equipo.equipoPadreId ? (
        <p>
          Montado en{' '}
          <button
            type="button"
            className="btn-enlace"
            onClick={() => onAbrir(equipo.equipoPadreId as string)}
          >
            {equipo.equipoPadreNombre}
          </button>
        </p>
      ) : (
        <p className="texto-suave texto-chico">
          Va suelto: no está montado dentro de ninguna máquina.
        </p>
      )}

      {puedeEditar && !dadoDeBaja && abierto === null && (
        <div className="fila-acciones">
          <button type="button" className="btn btn-chico" onClick={() => setAbierto('montar')}>
            {equipo.equipoPadreId ? 'Trasladar a otra máquina' : 'Montar en una máquina'}
          </button>
          {equipo.equipoPadreId && (
            <button type="button" className="btn btn-chico" onClick={() => setAbierto('desmontar')}>
              Desmontar
            </button>
          )}
        </div>
      )}

      {abierto === 'montar' && (
        <div className="panel formulario-modal">
          <label className="campo">
            {equipo.equipoPadreId ? '¿A qué máquina lo pasás?' : '¿En qué máquina va montado?'}
            <ComboEquipo onCambio={setElegido} />
          </label>
          <label className="campo">
            Motivo (opcional)
            <input
              type="text"
              maxLength={300}
              value={motivo}
              placeholder="Se cambió por la de repuesto"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className="acciones">
            <button type="button" className="btn" onClick={cerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primario"
              disabled={!elegido || ocupado}
              onClick={confirmarMontaje}
            >
              {ocupado ? 'Guardando…' : elegido ? `Montar en «${elegido.nombre}»` : 'Elegí la máquina'}
            </button>
          </div>
        </div>
      )}

      {abierto === 'desmontar' && (
        <div className="panel formulario-modal">
          <label className="campo">
            ¿Por qué se desmonta? (opcional)
            <input
              type="text"
              maxLength={300}
              value={motivo}
              placeholder="Se mandó a rebobinar"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className="acciones">
            <button type="button" className="btn" onClick={cerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-peligro"
              disabled={ocupado}
              onClick={confirmarDesmontaje}
            >
              {ocupado ? 'Guardando…' : `Desmontar de «${equipo.equipoPadreNombre}»`}
            </button>
          </div>
        </div>
      )}

      <details onToggle={(e) => setVerTramos((e.target as HTMLDetailsElement).open)}>
        <summary className="texto-suave texto-chico">Por dónde pasó</summary>
        {tramos.isLoading && <Cargando />}
        {tramos.error && <MensajeError error={tramos.error} />}
        {tramos.data && tramos.data.length === 0 && (
          <p className="texto-suave texto-chico">Nunca estuvo montado en ninguna máquina.</p>
        )}
        {tramos.data && tramos.data.length > 0 && (
          <ul className="lista-catalogo">
            {tramos.data.map((t) => (
              <li key={t.id}>
                <span>
                  <strong>{t.equipoPadreNombre}</strong>
                  <div className="texto-suave texto-chico">
                    {formatearFechaSola(t.desde)} → {t.hasta ? formatearFechaSola(t.hasta) : 'hoy'}
                    {t.motivo ? ` · ${t.motivo}` : ''}
                    {t.registradoPorNombre ? ` · ${t.registradoPorNombre}` : ''}
                  </div>
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      {/* ── Componentes ── */}
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">
          Componentes{lista.length > 0 ? ` (${lista.length})` : ''}
        </h3>
        {puedeEditar && !dadoDeBaja && abierto === null && (
          <button
            type="button"
            className="btn btn-chico btn-primario"
            onClick={() => setAbierto('agregar')}
          >
            + Agregar componente
          </button>
        )}
      </div>

      {abierto === 'agregar' && (
        <div className="panel formulario-modal">
          <label className="campo">
            ¿Qué equipo va montado en «{equipo.nombre}»?
            <ComboEquipo onCambio={setElegido} />
          </label>
          <p className="texto-suave texto-chico">
            Si ese equipo ya estaba montado en otra máquina, se traslada acá y queda registrado.
          </p>
          <label className="campo">
            Motivo (opcional)
            <input
              type="text"
              maxLength={300}
              value={motivo}
              placeholder="Instalación"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className="acciones">
            <button type="button" className="btn" onClick={cerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primario"
              disabled={!elegido || ocupado}
              onClick={confirmarComponente}
            >
              {ocupado ? 'Guardando…' : elegido ? `Montar «${elegido.nombre}» acá` : 'Elegí el equipo'}
            </button>
          </div>
        </div>
      )}

      {componentes.isLoading && <Cargando />}
      {componentes.error && <MensajeError error={componentes.error} />}
      {componentes.data && lista.length === 0 && abierto !== 'agregar' && (
        <p className="texto-suave texto-chico">No tiene otros equipos montados.</p>
      )}
      {lista.length > 0 && (
        <ul className="lista-catalogo">
          {lista.map((c) => (
            <li key={c.id}>
              <span>
                <button type="button" className="btn-enlace" onClick={() => onAbrir(c.id)}>
                  {c.nombre}
                </button>
                <div className="texto-suave texto-chico">
                  {c.tipoNombre ?? 'Sin tipo'}
                  {c.montadoDesde ? ` · desde ${formatearFechaSola(c.montadoDesde)}` : ''}
                  {c.cantidadComponentes > 0 ? ` · tiene ${c.cantidadComponentes} adentro` : ''}
                </div>
              </span>
              <span className={`etiqueta estado-${c.estado.toLowerCase()}`}>
                {ETIQUETA_ESTADO_EQUIPO[c.estado]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {aviso && <p className="aviso-escaneo es-error">{aviso}</p>}
    </>
  );
}
