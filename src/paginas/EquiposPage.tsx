import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useEliminarEquipo, useEquipos, useResumenEquipos } from '@/api/equipos';
import { AccionesFila } from '@/componentes/AccionesFila';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { FormularioEquipo } from '@/componentes/FormularioEquipo';
import { ImportarEquiposPlanta } from '@/componentes/ImportarEquiposPlanta';
import { CatalogosEquipo } from '@/componentes/CatalogosEquipo';
import { EtiquetasQr } from '@/componentes/EtiquetasQr';
import { CargarFotosPlanta } from '@/componentes/CargarFotosPlanta';
import { ESTADOS_EQUIPO, ETIQUETA_ESTADO_EQUIPO } from '@/tipos/equipo';
import type { Equipo, EstadoEquipo, FiltrosEquipos } from '@/tipos/equipo';
import { ETIQUETA_CLASIFICACION_PLURAL } from '@/tipos/ordenCompra';

const LIMITE = 20;

/** Cuántos filtros achican el listado. El orden no cuenta: no saca filas. */
function contarFiltros(f: FiltrosEquipos): number {
  return [f.ubicacionId, f.tipoId, f.estado, f.garantiaVencida || undefined].filter(
    (v) => v !== undefined && v !== '',
  ).length;
}

export function EquiposPage() {
  const [buscar, setBuscar] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosEquipos>({});
  const [panelFiltros, setPanelFiltros] = useState(false);
  const [editando, setEditando] = useState<Equipo | null>(null);
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [catalogos, setCatalogos] = useState(false);
  const [etiquetas, setEtiquetas] = useState(false);
  const [fotos, setFotos] = useState(false);

  const navegar = useNavigate();
  // Las etiquetas QR ya impresas y pegadas en las máquinas llevan a
  // /equipos?equipo=<id>. La ficha ahora es una página propia: esa dirección
  // tiene que seguir sirviendo, así que lleva a /equipos/<id>.
  const [parametros] = useSearchParams();
  const idPedido = parametros.get('equipo') ?? '';

  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, error, isFetching } = useEquipos(pagina, LIMITE, {
    ...filtros,
    buscar: busquedaDebounced,
  });
  // Con el filtro puesto: de este resumen salen las opciones que ofrecen los
  // desplegables, y tienen que ser las que existen DENTRO de lo ya filtrado.
  const { data: resumen } = useResumenEquipos(true, {
    clasificacion: filtros.clasificacion,
    estado: filtros.estado,
    buscar: busquedaDebounced,
  });
  const eliminar = useEliminarEquipo();

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;
  const puestos = contarFiltros(filtros);

  const cambiarFiltro = (parcial: Partial<FiltrosEquipos>) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    // Con el filtro nuevo, la página en la que estabas puede ya no existir.
    setPagina(1);
  };

  const borrar = async (e: Equipo) => {
    const aviso =
      `¿Eliminar "${e.nombre}"?\n\n` +
      'Si el equipo dejó de usarse, lo correcto es darlo de baja: conserva el historial. ' +
      'Eliminar es para las cargas equivocadas.';
    if (!confirm(aviso)) return;
    await eliminar.mutateAsync(e.id);
  };

  if (idPedido) return <Navigate to={`/equipos/${idPedido}`} replace />;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Equipos y herramientas</h1>
          <p className="texto-suave">
            Las máquinas e instalaciones de la planta y las herramientas con ficha propia: sus
            fotos, su historial y sus planes de mantenimiento.
          </p>
        </div>
        <div className="fila-acciones">
          <button className="btn" onClick={() => setFotos(true)}>
            🖼 Cargar fotos
          </button>
          <button className="btn" onClick={() => setEtiquetas(true)}>
            ▦ Etiquetas QR
          </button>
          <button className="btn" onClick={() => setCatalogos(true)}>
            ☰ Listas
          </button>
          <button className="btn" onClick={() => setImportando(true)}>
            ⬆ Importar carpeta
          </button>
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            + Nuevo equipo
          </button>
        </div>
      </div>

      {/* Las tarjetas dicen lo que en este modulo se puede accionar. Copiar las
          de informatica tal cual daria "326 equipos, 326 Operativo", que ocupa
          lugar sin decir nada: aca los 326 estan en el mismo estado. Lo que si
          hay para hacer es cargar los planes de mantenimiento. */}
      {resumen && (resumen.total ?? 0) > 0 && (
        <div className="tarjetas-resumen">
          <div className="tarjeta-resumen">
            <span className="tarjeta-numero">{resumen.total}</span>
            {/* La etiqueta sigue a la pestania: estando en Herramientas, decir
                "18 equipos" es contradecir lo que la persona acaba de elegir. */}
            <span className="texto-suave">
              {filtros.clasificacion
                ? ETIQUETA_CLASIFICACION_PLURAL[filtros.clasificacion].toLowerCase()
                : 'en total'}
            </span>
          </div>
          {/* `?? {}`: una pantalla no puede romperse porque una parte del
              resumen no vino. Antes reventaba entera y no se veia ni la tabla. */}
          {Object.entries(resumen.porEstado ?? {})
            .filter(([, cantidad]) => cantidad > 0)
            .map(([estado, cantidad]) => (
              <div className="tarjeta-resumen" key={estado}>
                <span className="tarjeta-numero">{cantidad}</span>
                <span className="texto-suave">
                  {ETIQUETA_ESTADO_EQUIPO[estado as EstadoEquipo] ?? estado}
                </span>
              </div>
            ))}
          {(resumen.sinPlan ?? 0) > 0 && (
            <div className="tarjeta-resumen">
              <span className="tarjeta-numero">{resumen.sinPlan}</span>
              <span className="texto-suave">sin plan de mantenimiento</span>
            </div>
          )}
        </div>
      )}

      {/* Maquinas y herramientas son dos cosas distintas y se buscan por
          separado. Van como pestanias y no como un desplegable mas: es un
          clic, y de entrada se ve cuantas hay de cada una. */}
      <div className="pestanias-clasificacion">
        {([undefined, 'EQUIPO', 'HERRAMIENTA'] as const).map((c) => {
          const cantidad =
            c === undefined
              ? Object.values(resumen?.porClasificacion ?? {}).reduce((a, b) => a + b, 0)
              : (resumen?.porClasificacion?.[c] ?? 0);
          const activa = filtros.clasificacion === c;
          return (
            <button
              key={c ?? 'todos'}
              className={activa ? 'pestania activa' : 'pestania'}
              aria-pressed={activa}
              onClick={() =>
                cambiarFiltro({ clasificacion: c, tipoId: undefined, ubicacionId: undefined })
              }
            >
              {c === undefined ? 'Todos' : ETIQUETA_CLASIFICACION_PLURAL[c]}
              <span className="pestania-cuenta">{cantidad}</span>
            </button>
          );
        })}
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="🔍 Buscar por nombre o código…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <button
          className={puestos > 0 ? 'btn btn-primario' : 'btn'}
          onClick={() => setPanelFiltros((v) => !v)}
        >
          ⚗ Filtros{puestos > 0 ? ` (${puestos})` : ''}
        </button>
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      {/* Los tres que se usan todos los dias van a la vista, como en
          informatica. Los otros siguen detras del boton: tenerlos siempre
          desplegados hace que no se vea la tabla en una pantalla de notebook. */}
      <div className="grilla-filtros">
        <select
          value={filtros.tipoId ?? ''}
          onChange={(e) => cambiarFiltro({ tipoId: e.target.value || undefined })}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {(resumen?.tipos ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({t.cantidad})
            </option>
          ))}
        </select>
        <select
          value={filtros.estado ?? ''}
          onChange={(e) => cambiarFiltro({ estado: (e.target.value || undefined) as EstadoEquipo })}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_EQUIPO.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_EQUIPO[e]}
            </option>
          ))}
        </select>
        <select
          value={filtros.ubicacionId ?? ''}
          onChange={(e) => cambiarFiltro({ ubicacionId: e.target.value || undefined })}
          aria-label="Filtrar por ubicación"
        >
          <option value="">Todas las ubicaciones</option>
          {(resumen?.ubicaciones ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({u.cantidad})
            </option>
          ))}
        </select>
      </div>

      {panelFiltros && (
        <div className="panel filtros-materiales">
          <div className="filtros-grilla">
            <label>
              Ordenar por
              <select
                value={filtros.ordenarPor ?? 'nombre'}
                onChange={(e) =>
                  cambiarFiltro({ ordenarPor: e.target.value as FiltrosEquipos['ordenarPor'] })
                }
              >
                <option value="nombre">Nombre</option>
                <option value="codigo">Código</option>
                <option value="ubicacion">Ubicación</option>
              </select>
            </label>

            <label>
              Orden
              <select
                value={filtros.direccion ?? 'asc'}
                onChange={(e) => cambiarFiltro({ direccion: e.target.value as 'asc' | 'desc' })}
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </label>
          </div>

          <div className="filtros-pie">
            <label className="filtro-check">
              <input
                type="checkbox"
                checked={filtros.garantiaVencida ?? false}
                onChange={(e) => cambiarFiltro({ garantiaVencida: e.target.checked })}
              />
              Solo los que ya no están en garantía
            </label>
            {puestos > 0 && (
              <button className="btn btn-chico" onClick={() => setFiltros({})}>
                ✕ Limpiar filtros ({puestos})
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {puestos > 0 || busquedaDebounced
            ? 'Ningún equipo coincide con la búsqueda.'
            : 'Todavía no hay equipos cargados.'}
        </EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Marca y modelo</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.datos.map((e) => (
                <tr key={e.id} onClick={() => navegar(`/equipos/${e.id}`)} style={{ cursor: 'pointer' }}>
                  <td data-etiqueta="Equipo">
                    {/* Un solo bloque: en el celular la celda es «etiqueta | valor», y
                        cada renglón suelto se ponía al lado del nombre y se cortaba. */}
                    <div>
                      <strong>{e.nombre}</strong>
                      {e.codigoInterno && (
                        <div className="texto-suave texto-chico">{e.codigoInterno}</div>
                      )}
                      {e.equipoPadreNombre && (
                        <div className="texto-suave texto-chico">en {e.equipoPadreNombre}</div>
                      )}
                    </div>
                  </td>
                  <td data-etiqueta="Tipo">{e.tipoNombre ?? '—'}</td>
                  <td data-etiqueta="Marca y modelo">
                    {e.marcaNombre ? (
                      <>
                        <strong>{e.marcaNombre}</strong> {e.modeloNombre ?? ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-etiqueta="Ubicación">{e.ubicacionNombre ?? '—'}</td>
                  <td data-etiqueta="Estado">
                    <span className={`etiqueta estado-${e.estado.toLowerCase()}`}>
                      {ETIQUETA_ESTADO_EQUIPO[e.estado]}
                    </span>
                  </td>
                  <td className="celda-acciones" onClick={(ev) => ev.stopPropagation()}>
                    <AccionesFila
                      descripcion={`el equipo ${e.nombre}`}
                      onEditar={() => setEditando(e)}
                      onEliminar={() => borrar(e)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPaginas > 1 && (
        <div className="paginacion">
          <button className="btn" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="texto-suave">
            Página {pagina} de {totalPaginas} · {data.total} equipos
          </span>
          <button
            className="btn"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      {(creando || editando) && (
        <FormularioEquipo
          equipo={editando ?? undefined}
          alCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}


      {importando && <ImportarEquiposPlanta onCerrar={() => setImportando(false)} />}
      <CatalogosEquipo abierto={catalogos} onCerrar={() => setCatalogos(false)} />
      {etiquetas && <EtiquetasQr onCerrar={() => setEtiquetas(false)} />}
      {fotos && <CargarFotosPlanta onCerrar={() => setFotos(false)} />}
    </>
  );
}
