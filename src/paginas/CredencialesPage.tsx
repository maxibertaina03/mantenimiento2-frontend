import {
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  KeyRound,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useActualizarCredencial,
  useCredenciales,
  useEliminarCredencial,
  useTiposCredencial,
  type Credencial,
  type EstadoRotacion,
  type FiltrosCredenciales,
} from '@/api/credenciales';
import { HistorialCredencial, RotarCredencial, VerSecreto } from '@/componentes/AccionesCredencial';
import { ComboEquipoIt } from '@/componentes/ComboEquipoIt';
import { FormularioCredencial } from '@/componentes/FormularioCredencial';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { MenuDesplegable } from '@/componentes/MenuDesplegable';
import { P, usePuede } from '@/lib/permisos';

const LIMITE = 20;

/** Cómo se ve el estado de rotación. */
const ROTACION: Record<EstadoRotacion, { texto: string; clase: string }> = {
  'sin-rotacion': { texto: 'sin vencimiento', clase: 'badge' },
  'al-dia': { texto: 'al día', clase: 'badge badge-ok' },
  'por-vencer': { texto: 'por vencer', clase: 'badge badge-aviso' },
  vencida: { texto: 'vencida', clase: 'badge badge-error' },
};

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short' }) : '—';

/** Si «dónde se usa» es una dirección web, se puede abrir. */
const esEnlace = (url: string) => /^https?:\/\//i.test(url);

/**
 * El baúl de credenciales.
 *
 * La contraseña no está en esta pantalla. El servidor no la manda en el
 * listado: para verla hay que pedirla, y ese pedido queda registrado. Lo que se
 * ve de cada una es lo que hace falta para encontrarla y usarla: el usuario,
 * dónde se usa, de qué equipo es, las notas y cuándo hay que cambiarla.
 */
export function CredencialesPage() {
  const puede = usePuede();
  const puedeEditar = puede(P.CREDENCIALES_EDITAR);
  const [buscar, setBuscar] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [rotacion, setRotacion] = useState<FiltrosCredenciales['rotacion']>('');
  const [equipoIt, setEquipoIt] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [verInactivas, setVerInactivas] = useState(false);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const filtros: FiltrosCredenciales = {
    buscar: busqueda,
    tipoId: tipoId || undefined,
    rotacion,
    equipoItId: equipoIt?.id,
    mostrar: verInactivas ? 'todas' : 'activas',
  };
  const { data, isLoading, error, isFetching } = useCredenciales(pagina, LIMITE, filtros);
  const { data: tipos } = useTiposCredencial();

  const actualizar = useActualizarCredencial();
  const eliminar = useEliminarCredencial();

  // El formulario: `null` cerrado, `'nueva'` para cargar una, o la que se edita.
  const [formulario, setFormulario] = useState<Credencial | 'nueva' | null>(null);
  const [viendo, setViendo] = useState<Credencial | null>(null);
  const [rotando, setRotando] = useState<Credencial | null>(null);
  const [historial, setHistorial] = useState<Credencial | null>(null);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  const abrirNueva = () => setFormulario('nueva');
  const abrirEdicion = (c: Credencial) => setFormulario(c);

  const borrar = async (c: Credencial) => {
    if (
      !confirm(
        `¿Borrar "${c.nombre}" y todo su historial?\n\n` +
          'Si solo dejaste de usarla, conviene desactivarla: así se conserva el registro de quién vio qué.',
      )
    )
      return;
    await eliminar.mutateAsync(c.id);
  };

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Contraseñas</h1>
          <p className="texto-suave">
            Se guardan cifradas. Para ver una hay que pedirla, y queda registrado quién la vio.
          </p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primario" onClick={abrirNueva}>
            <Plus className="icono" aria-hidden />
            Nueva credencial
          </button>
        )}
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar por nombre, usuario o notas…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      <div className="filtros-credenciales">
        <label className="campo">
          Tipo
          <select
            value={tipoId}
            onChange={(e) => {
              setTipoId(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {(tipos ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Rotación
          <select
            value={rotacion}
            onChange={(e) => {
              setRotacion(e.target.value as FiltrosCredenciales['rotacion']);
              setPagina(1);
            }}
          >
            <option value="">Todas</option>
            <option value="pendiente">Hay que cambiarlas</option>
            <option value="vencida">Vencidas</option>
            <option value="por-vencer">Vencen esta semana</option>
          </select>
        </label>

        <div className="campo">
          <span>Equipo de informática</span>
          <ComboEquipoIt
            onCambio={(e) => {
              setEquipoIt(e);
              setPagina(1);
            }}
          />
        </div>
      </div>

      <label className="casilla">
        <input
          type="checkbox"
          checked={verInactivas}
          onChange={(e) => {
            setVerInactivas(e.target.checked);
            setPagina(1);
          }}
        />
        Mostrar también las desactivadas
      </label>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}
      {actualizar.error && !formulario && <MensajeError error={actualizar.error} />}

      {data && data.datos.length > 0 && (
        <ul className="lista-credenciales">
          {data.datos.map((c) => {
            const estado = ROTACION[c.estadoRotacion];
            return (
              <li key={c.id} className={`panel tarjeta-credencial ${c.activo ? '' : 'inactiva'}`}>
                <div className="tarjeta-credencial-cabecera">
                  <span className="tarjeta-credencial-icono" aria-hidden>
                    <KeyRound />
                  </span>
                  <div className="tarjeta-credencial-titulo">
                    <strong>{c.nombre}</strong>
                    <span className="tarjeta-credencial-etiquetas">
                      {c.tipoNombre && <span className="badge">{c.tipoNombre}</span>}
                      {!c.activo && <span className="badge badge-error">desactivada</span>}
                    </span>
                  </div>
                  <span className="tarjeta-credencial-rotacion">
                    <span className={estado.clase}>{estado.texto}</span>
                    {c.proximaRotacion && (
                      <span className="texto-suave texto-chico">
                        cambiarla el {fechaCorta(c.proximaRotacion)}
                      </span>
                    )}
                  </span>
                </div>

                <dl className="tarjeta-credencial-datos">
                  <div>
                    <dt>Usuario</dt>
                    <dd>{c.usuario ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Dónde se usa</dt>
                    <dd>
                      {c.url ? (
                        esEnlace(c.url) ? (
                          <a href={c.url} target="_blank" rel="noreferrer noopener">
                            {c.url}
                          </a>
                        ) : (
                          c.url
                        )
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  {c.equipoItNombre && (
                    <div>
                      <dt>Equipo</dt>
                      <dd className="con-icono">
                        <Monitor className="icono" aria-hidden />
                        {c.equipoItNombre}
                      </dd>
                    </div>
                  )}
                </dl>

                {c.notas && (
                  <p className="tarjeta-credencial-notas">
                    <StickyNote className="icono" aria-hidden />
                    <span>{c.notas}</span>
                  </p>
                )}

                <div className="tarjeta-credencial-acciones">
                  <button className="btn btn-sm btn-primario" onClick={() => setViendo(c)}>
                    <Eye className="icono" aria-hidden />
                    Ver
                  </button>
                  {puedeEditar && (
                    <button className="btn btn-sm" onClick={() => setRotando(c)}>
                      <KeyRound className="icono" aria-hidden />
                      Cambiar
                    </button>
                  )}
                  <MenuDesplegable
                    texto="Más"
                    Icono={MoreHorizontal}
                    opciones={[
                      {
                        texto: 'Historial',
                        Icono: History,
                        onElegir: () => setHistorial(c),
                      },
                      ...(puedeEditar
                        ? [
                            {
                              texto: 'Editar',
                              Icono: Pencil,
                              onElegir: () => abrirEdicion(c),
                            },
                            {
                              texto: c.activo ? 'Desactivar' : 'Activar',
                              Icono: Power,
                              onElegir: () =>
                                actualizar.mutate({
                                  id: c.id,
                                  activo: !c.activo,
                                }),
                            },
                            {
                              texto: 'Eliminar',
                              Icono: Trash2,
                              onElegir: () => void borrar(c),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busqueda || tipoId || rotacion || equipoIt
            ? 'Ninguna credencial cumple con ese filtro.'
            : 'Todavía no hay ninguna credencial guardada.'}
        </EstadoVacio>
      )}

      {data && data.total > LIMITE && (
        <div className="paginacion">
          <span className="texto-suave">{data.total} credenciales</span>
          <div className="fila-acciones">
            <button
              className="btn btn-sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              <ChevronLeft className="icono" aria-hidden />
              Anterior
            </button>
            <span className="texto-suave">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              className="btn btn-sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
              <ChevronRight className="icono" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {formulario && (
        <FormularioCredencial
          editando={formulario === 'nueva' ? null : formulario}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {viendo && <VerSecreto credencial={viendo} onCerrar={() => setViendo(null)} />}
      {rotando && <RotarCredencial credencial={rotando} onCerrar={() => setRotando(null)} />}
      {historial && (
        <HistorialCredencial credencial={historial} onCerrar={() => setHistorial(null)} />
      )}
    </>
  );
}
