import { useEffect, useState } from 'react';
import {
  useActualizarEquipo,
  useAlmacenDisponible,
  useCrearEquipo,
  useEliminarEquipo,
  useEquipos,
} from '@/api/equipos';
import { useCatalogoEquipos } from '@/api/catalogosEquipo';
import { AccionesFila } from '@/componentes/AccionesFila';
import { CampoNumero } from '@/componentes/CampoNumero';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { FotoEquipo } from '@/componentes/FotoEquipo';
import { HistorialEquipo } from '@/componentes/HistorialEquipo';
import { PlanesEquipo } from '@/componentes/PlanesEquipo';
import { ImportarEquiposPlanta } from '@/componentes/ImportarEquiposPlanta';
import { Modal } from '@/componentes/Modal';
import { formatearFechaSola } from '@/lib/formato';
import { ESTADOS_EQUIPO, ETIQUETA_ESTADO_EQUIPO, TRANSICIONES_ESTADO } from '@/tipos/equipo';
import type { CrearEquipoInput, Equipo, EstadoEquipo, FiltrosEquipos } from '@/tipos/equipo';

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
  const [viendo, setViendo] = useState<Equipo | null>(null);
  const [importando, setImportando] = useState(false);

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
  const { ubicaciones, tipos } = useCatalogoEquipos();
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

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Equipos</h1>
        <div className="fila-acciones">
          <button className="btn" onClick={() => setImportando(true)}>
            ⬆ Importar carpeta
          </button>
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            + Nuevo equipo
          </button>
        </div>
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

      {panelFiltros && (
        <div className="panel filtros-materiales">
          <div className="filtros-grilla">
            <label>
              Ubicación
              <select
                value={filtros.ubicacionId ?? ''}
                onChange={(e) => cambiarFiltro({ ubicacionId: e.target.value || undefined })}
              >
                <option value="">Todas</option>
                {(ubicaciones.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo
              <select
                value={filtros.tipoId ?? ''}
                onChange={(e) => cambiarFiltro({ tipoId: e.target.value || undefined })}
              >
                <option value="">Todos</option>
                {(tipos.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado
              <select
                value={filtros.estado ?? ''}
                onChange={(e) =>
                  cambiarFiltro({ estado: (e.target.value || undefined) as EstadoEquipo })
                }
              >
                <option value="">Todos</option>
                {ESTADOS_EQUIPO.map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_ESTADO_EQUIPO[e]}
                  </option>
                ))}
              </select>
            </label>


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
                <th>Ubicación</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.datos.map((e) => (
                <tr key={e.id} onClick={() => setViendo(e)} style={{ cursor: 'pointer' }}>
                  <td data-etiqueta="Equipo">
                    <strong>{e.nombre}</strong>
                    {e.codigoInterno && <div className="texto-suave texto-chico">{e.codigoInterno}</div>}
                  </td>
                  <td data-etiqueta="Ubicación">{e.ubicacionNombre ?? '—'}</td>
                  <td data-etiqueta="Tipo">{e.tipoNombre ?? '—'}</td>
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

      {viendo && <FichaEquipo equipo={viendo} onCerrar={() => setViendo(null)} />}

      {importando && <ImportarEquiposPlanta onCerrar={() => setImportando(false)} />}
    </>
  );
}

/** La ficha, al tocar la fila. En el celular es la forma de ver todo el detalle. */
function FichaEquipo({ equipo, onCerrar }: { equipo: Equipo; onCerrar: () => void }) {
  // Si el servidor no tiene almacén, no se ofrece cargar fotos: prometer algo
  // que va a fallar es peor que no ofrecerlo.
  const almacen = useAlmacenDisponible();

  const dato = (etiqueta: string, valor: string | null | undefined) => (
    <div className="dato">
      <span className="texto-suave texto-chico">{etiqueta}</span>
      <span>{valor || '—'}</span>
    </div>
  );

  return (
    <Modal titulo={equipo.nombre} abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        {almacen.data?.disponible ? (
          <FotoEquipo equipo={equipo} />
        ) : (
          equipo.fotoUrl && <img src={equipo.fotoUrl} alt={equipo.nombre} className="foto-equipo" />
        )}

        <div className="grilla-datos">
          {dato('Código', equipo.codigoInterno)}
          {dato('Estado', ETIQUETA_ESTADO_EQUIPO[equipo.estado])}
          {dato('Ubicación', equipo.ubicacionNombre)}
          {dato('Tipo', equipo.tipoNombre)}
          {dato('Marca', equipo.marca)}
          {dato('Modelo', equipo.modelo)}
          {dato('N° de serie', equipo.numeroSerie)}
          {dato('Proveedor', equipo.proveedorNombre)}
          {dato('Horas de uso', equipo.horasUso === null ? null : String(equipo.horasUso))}
          {dato('Alta', equipo.fechaAlta ? formatearFechaSola(equipo.fechaAlta) : null)}
          {dato(
            'Garantía',
            equipo.garantiaHasta
              ? `${formatearFechaSola(equipo.garantiaHasta)}${equipo.garantiaVencida ? ' · vencida' : ''}`
              : null,
          )}
        </div>

        {equipo.descripcion && (
          <div>
            <span className="texto-suave texto-chico">Descripción</span>
            <p>{equipo.descripcion}</p>
          </div>
        )}

        <PlanesEquipo equipo={equipo} />

        <HistorialEquipo equipo={equipo} />

        <p className="texto-suave texto-chico">
          {almacen.data?.disponible === false && 'La carga de fotos no está configurada. '}
          Los avisos por correo antes de cada vencimiento llegan en la próxima fase.
        </p>

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FormularioEquipo({ equipo, alCerrar }: { equipo?: Equipo; alCerrar: () => void }) {
  const esEdicion = equipo !== undefined;
  const { ubicaciones, tipos } = useCatalogoEquipos();
  const crear = useCrearEquipo();
  const actualizar = useActualizarEquipo();
  const guardando = crear.isPending || actualizar.isPending;
  const error = crear.error ?? actualizar.error;

  const [form, setForm] = useState<CrearEquipoInput & { estado?: EstadoEquipo }>({
    nombre: equipo?.nombre ?? '',
    codigoInterno: equipo?.codigoInterno ?? '',
    descripcion: equipo?.descripcion ?? '',
    marca: equipo?.marca ?? '',
    modelo: equipo?.modelo ?? '',
    numeroSerie: equipo?.numeroSerie ?? '',
    ubicacionId: equipo?.ubicacionId ?? '',
    tipoId: equipo?.tipoId ?? '',
    horasUso: equipo?.horasUso ?? undefined,
    fechaAlta: equipo?.fechaAlta?.slice(0, 10) ?? '',
    garantiaHasta: equipo?.garantiaHasta?.slice(0, 10) ?? '',
    estado: equipo?.estado,
  });

  const cambiar = (parcial: Partial<typeof form>) => setForm((f) => ({ ...f, ...parcial }));

  // Los campos vacíos viajan como null (borrar) y no como "": el backend
  // normaliza igual, pero mandar "" ensucia el cuerpo de la request.
  const oNull = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const datos = {
      nombre: form.nombre.trim(),
      codigoInterno: oNull(form.codigoInterno),
      descripcion: oNull(form.descripcion),
      marca: oNull(form.marca),
      modelo: oNull(form.modelo),
      numeroSerie: oNull(form.numeroSerie),
      ubicacionId: oNull(form.ubicacionId),
      tipoId: oNull(form.tipoId),
      horasUso: form.horasUso ?? null,
      fechaAlta: oNull(form.fechaAlta),
      garantiaHasta: oNull(form.garantiaHasta),
    };

    if (esEdicion) {
      await actualizar.mutateAsync({ id: equipo.id, ...datos, estado: form.estado });
    } else {
      await crear.mutateAsync(datos);
    }
    alCerrar();
  };

  // Solo los estados a los que se puede llegar desde el actual: el backend
  // rechaza el resto, y ofrecerlos sería prometer algo que no se cumple.
  const estadosPosibles = equipo
    ? [equipo.estado, ...TRANSICIONES_ESTADO[equipo.estado]]
    : ([] as EstadoEquipo[]);

  return (
    <Modal
      titulo={esEdicion ? `Editar ${equipo.nombre}` : 'Nuevo equipo'}
      abierto
      tamano="ancho"
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <div className="fila-campos">
          <div className="campo">
            <label>Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => cambiar({ nombre: e.target.value })}
              required
              maxLength={120}
              autoFocus
              placeholder="Compresor 1"
            />
          </div>
          <div className="campo">
            <label>Código interno</label>
            <input
              value={form.codigoInterno ?? ''}
              onChange={(e) => cambiar({ codigoInterno: e.target.value })}
              maxLength={40}
              placeholder="COMP-01"
            />
          </div>
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Ubicación</label>
            <select
              value={form.ubicacionId ?? ''}
              onChange={(e) => cambiar({ ubicacionId: e.target.value })}
            >
              <option value="">Sin ubicación</option>
              {(ubicaciones.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select value={form.tipoId ?? ''} onChange={(e) => cambiar({ tipoId: e.target.value })}>
              <option value="">Sin tipo</option>
              {(tipos.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fila-campos">
          {esEdicion && (
            <div className="campo">
              <label>Estado</label>
              <select
                value={form.estado ?? equipo.estado}
                onChange={(e) => cambiar({ estado: e.target.value as EstadoEquipo })}
              >
                {estadosPosibles.map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_ESTADO_EQUIPO[e]}
                  </option>
                ))}
              </select>
              {equipo.estado === 'DADO_DE_BAJA' && (
                <span className="texto-suave texto-chico">
                  Un equipo dado de baja no vuelve a otro estado.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Marca</label>
            <input value={form.marca ?? ''} onChange={(e) => cambiar({ marca: e.target.value })} />
          </div>
          <div className="campo">
            <label>Modelo</label>
            <input value={form.modelo ?? ''} onChange={(e) => cambiar({ modelo: e.target.value })} />
          </div>
          <div className="campo">
            <label>N° de serie</label>
            <input
              value={form.numeroSerie ?? ''}
              onChange={(e) => cambiar({ numeroSerie: e.target.value })}
            />
          </div>
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Horas de uso</label>
            <CampoNumero
              min={0}
              step="0.1"
              placeholder="opcional"
              valor={form.horasUso ?? undefined}
              onCambio={(v) => cambiar({ horasUso: v })}
            />
          </div>
          <div className="campo">
            <label>Fecha de alta</label>
            <input
              type="date"
              value={form.fechaAlta ?? ''}
              onChange={(e) => cambiar({ fechaAlta: e.target.value })}
            />
          </div>
          <div className="campo">
            <label>Garantía hasta</label>
            <input
              type="date"
              value={form.garantiaHasta ?? ''}
              onChange={(e) => cambiar({ garantiaHasta: e.target.value })}
            />
          </div>
        </div>

        <div className="campo">
          <label>Descripción</label>
          <textarea
            rows={3}
            value={form.descripcion ?? ''}
            onChange={(e) => cambiar({ descripcion: e.target.value })}
            placeholder="Para qué se usa, particularidades, dónde está exactamente…"
          />
        </div>

        {error && <MensajeError error={error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
