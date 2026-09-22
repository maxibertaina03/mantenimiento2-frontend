import { useEffect, useMemo, useState } from 'react';
import {
  useAsignacionesEquipo,
  useAsignarEquipo,
  useActualizarEquipo,
  useCrearEquipo,
  useEliminarEquipo,
  useEquipos,
  useResumenEquipos,
  useTiposEquipo,
} from '@/api/equiposIt';
import {
  useCatalogoIt,
  useCrearItemCatalogo,
  useCrearModelo,
  useModelosDeMarca,
} from '@/api/catalogosEquipo';
import { useCrearResponsable, useResponsables } from '@/api/responsables';
import { AccionesFila } from '@/componentes/AccionesFila';
import { CredencialesDelEquipo } from '@/componentes/CredencialesDelEquipo';
import { ResponsablesEquipo } from '@/componentes/ResponsablesEquipo';
import { SelectorCatalogo } from '@/componentes/SelectorCatalogo';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ImportarEquipos } from '@/componentes/ImportarEquipos';
import { TiposEquipo } from '@/componentes/TiposEquipo';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearFechaSola } from '@/lib/formato';
import { ETIQUETA_ACCESO, ETIQUETA_ESTADO } from '@/tipos/equipoIt';
import type { CrearEquipoInput, EquipoIt, EstadoEquipoIt } from '@/tipos/equipoIt';

const LIMITE = 20;

const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoEquipoIt[];

/** Clase del badge según el estado, para que se lea de un vistazo. */
const CLASE_ESTADO: Record<EstadoEquipoIt, string> = {
  EN_USO: 'badge badge-ok',
  EN_DEPOSITO: 'badge',
  EN_REPARACION: 'badge badge-aviso',
  DADO_DE_BAJA: 'badge badge-error',
};

/** El tipo se completa con el primero del catálogo al abrir el formulario. */
const FORMULARIO_VACIO: CrearEquipoInput = {
  tipoId: '',
};

/**
 * Cómo se nombra un equipo en pantalla.
 *
 * Marca y modelo salen del catálogo y pueden faltar: en el inventario real, 28
 * de 65 equipos no tienen marca porque decía "Sin especificar". Cuando faltan,
 * el que identifica es el código interno, que es la etiqueta pegada al equipo.
 */
function nombreDelEquipo(e: EquipoIt): string {
  const marcaYModelo = [e.marcaNombre, e.modeloNombre].filter(Boolean).join(' ');
  return marcaYModelo || e.codigoInterno || e.tipoNombre || 'Equipo sin identificar';
}

export function EquiposItPage() {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [estado, setEstado] = useState<EstadoEquipoIt | ''>('');
  const [marcaId, setMarcaId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [responsableId, setResponsableId] = useState('');

  const [modalAlta, setModalAlta] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalTipos, setModalTipos] = useState(false);
  const [modalResponsables, setModalResponsables] = useState(false);
  const [equipoDetalle, setEquipoDetalle] = useState<EquipoIt | null>(null);
  const [equipoAsignar, setEquipoAsignar] = useState<EquipoIt | null>(null);
  const [equipoEditar, setEquipoEditar] = useState<EquipoIt | null>(null);

  // Debounce de la búsqueda para no pegarle a la API en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data, isLoading, error } = useEquipos(pagina, LIMITE, {
    buscar: busquedaDebounced,
    tipoId,
    estado,
    marcaId,
    ubicacionId,
    // "sin" es un valor especial del mismo desplegable: filtrar por responsable
    // y "sin responsable" a la vez es contradictorio, y un desplegable no deja
    // elegir las dos cosas.
    responsableId: responsableId === 'sin' ? undefined : responsableId,
    sinResponsable: responsableId === 'sin',
  });
  const { data: tiposCatalogo } = useTiposEquipo();
  const { data: resumen } = useResumenEquipos();
  const { marcas: marcasCatalogo, ubicaciones: ubicacionesCatalogo } = useCatalogoIt();
  const { data: responsablesCatalogo } = useResponsables(true);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  return (
    <div>
      <header className="cabecera-pagina">
        <div>
          <h1>Equipos IT</h1>
          <p className="texto-suave">
            Inventario de equipos informáticos: PCs, notebooks, servidores, celulares y cámaras.
          </p>
        </div>
        <div className="fila-acciones">
          <button className="btn" onClick={() => setModalTipos(true)}>
            ⚙ Tipos
          </button>
          <button className="btn" onClick={() => setModalResponsables(true)}>
            👤 Responsables
          </button>
          <button className="btn" onClick={() => setModalImportar(true)}>
            ↑ Importar CSV
          </button>
          <button className="btn btn-primario" onClick={() => setModalAlta(true)}>
            + Nuevo equipo
          </button>
        </div>
      </header>

      {resumen && resumen.total > 0 && (
        <div className="tarjetas-resumen">
          <div className="tarjeta-resumen">
            <span className="tarjeta-numero">{resumen.total}</span>
            <span className="texto-suave">equipos</span>
          </div>
          {resumen.porEstado.map((e) => (
            <div className="tarjeta-resumen" key={e.estado}>
              <span className="tarjeta-numero">{e.cantidad}</span>
              <span className="texto-suave">{ETIQUETA_ESTADO[e.estado]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grilla-filtros">
        <input
          type="search"
          placeholder="🔍 Buscar por código, marca, modelo, serie, IP o nombre de red…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          value={tipoId}
          onChange={(e) => {
            setTipoId(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {(tiposCatalogo ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as EstadoEquipoIt | '');
            setPagina(1);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </select>
        <select
          value={marcaId}
          onChange={(e) => {
            setMarcaId(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por marca"
        >
          <option value="">Todas las marcas</option>
          {(marcasCatalogo.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select
          value={ubicacionId}
          onChange={(e) => {
            setUbicacionId(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por ubicación"
        >
          <option value="">Todas las ubicaciones</option>
          {(ubicacionesCatalogo.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
        <select
          value={responsableId}
          onChange={(e) => {
            setResponsableId(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por responsable"
        >
          <option value="">Todos los responsables</option>
          <option value="sin">— Sin responsable (en depósito) —</option>
          {(responsablesCatalogo ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && <MensajeError error={error} />}
      {isLoading && <Cargando />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busquedaDebounced || tipoId || estado
            ? 'No hay equipos que coincidan con el filtro.'
            : 'Todavía no cargaste ningún equipo.'}
        </EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Equipo</th>
                <th>Responsable</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.datos.map((equipo) => (
                <tr key={equipo.id}>
                  <td data-etiqueta="Código">{equipo.codigoInterno ?? '—'}</td>
                  <td data-etiqueta="Tipo">{equipo.tipoNombre ?? '—'}</td>
                  <td data-etiqueta="Equipo">
                    <strong>{equipo.marcaNombre ?? 'Sin marca'}</strong> {equipo.modeloNombre ?? ''}
                    {equipo.direccionIp && (
                      <div className="texto-suave texto-chico">{equipo.direccionIp}</div>
                    )}
                  </td>
                  <td data-etiqueta="Responsable">
                    {equipo.responsableNombre ?? <span className="texto-suave">Depósito</span>}
                  </td>
                  <td data-etiqueta="Ubicación">{equipo.ubicacionNombre ?? '—'}</td>
                  <td data-etiqueta="Estado">
                    <span className={CLASE_ESTADO[equipo.estado]}>
                      {ETIQUETA_ESTADO[equipo.estado]}
                    </span>
                    {equipo.garantiaVencida && (
                      <div className="texto-suave texto-chico">Garantía vencida</div>
                    )}
                  </td>
                  <td className="celda-acciones">
                    <div className="fila-acciones">
                      <AccionesFila
                        descripcion={nombreDelEquipo(equipo)}
                        onVer={() => setEquipoDetalle(equipo)}
                        onEditar={() => setEquipoEditar(equipo)}
                      />
                      <button
                        className="btn btn-sm"
                        onClick={() => setEquipoAsignar(equipo)}
                        title="Asignar o devolver a depósito"
                      >
                        Asignar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPaginas > 1 && (
        <div className="acciones paginacion">
          <button
            className="btn btn-sm"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span className="texto-suave">
            Página {pagina} de {totalPaginas} · {data.total} equipos
          </span>
          <button
            className="btn btn-sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      <ImportarEquipos abierto={modalImportar} onCerrar={() => setModalImportar(false)} />
      <TiposEquipo abierto={modalTipos} onCerrar={() => setModalTipos(false)} />
      {modalResponsables && <ResponsablesEquipo onCerrar={() => setModalResponsables(false)} />}
      {modalAlta && <ModalAltaEquipo alCerrar={() => setModalAlta(false)} />}
      {equipoEditar && (
        <ModalAltaEquipo equipo={equipoEditar} alCerrar={() => setEquipoEditar(null)} />
      )}
      {equipoDetalle && (
        <ModalDetalleEquipo
          equipo={equipoDetalle}
          alCerrar={() => setEquipoDetalle(null)}
          alEditar={() => {
            const e = equipoDetalle;
            setEquipoDetalle(null);
            setEquipoEditar(e);
          }}
        />
      )}
      {equipoAsignar && (
        <ModalAsignar equipo={equipoAsignar} alCerrar={() => setEquipoAsignar(null)} />
      )}
    </div>
  );
}

// ─────────────────────────── Alta ───────────────────────────

/** Toma del equipo solo los campos que el formulario edita. */
function aFormulario(equipo: EquipoIt): CrearEquipoInput {
  return {
    codigoInterno: equipo.codigoInterno ?? undefined,
    tipoId: equipo.tipoId,
    estado: equipo.estado,
    marcaId: equipo.marcaId ?? undefined,
    modeloId: equipo.modeloId ?? undefined,
    numeroSerie: equipo.numeroSerie ?? undefined,
    procesador: equipo.procesador ?? undefined,
    memoriaRamGb: equipo.memoriaRamGb ?? undefined,
    discoTipo: equipo.discoTipo ?? undefined,
    discoCapacidadGb: equipo.discoCapacidadGb ?? undefined,
    sistemaOperativo: equipo.sistemaOperativo ?? undefined,
    direccionIp: equipo.direccionIp ?? undefined,
    direccionMac: equipo.direccionMac ?? undefined,
    nombreEnRed: equipo.nombreEnRed ?? undefined,
    accesoRemoto: equipo.accesoRemoto,
    accesoRemotoId: equipo.accesoRemotoId ?? undefined,
    ubicacionId: equipo.ubicacionId ?? undefined,
    proveedorId: equipo.proveedorId ?? undefined,
    fechaCompra: equipo.fechaCompra ?? undefined,
    garantiaHasta: equipo.garantiaHasta ?? undefined,
    notas: equipo.notas ?? undefined,
  };
}

/**
 * Mismo formulario para dar de alta y para editar: los campos son los mismos y
 * mantener dos copias garantizaba que se desincronizaran.
 */
function ModalAltaEquipo({
  alCerrar,
  equipo,
}: {
  alCerrar: () => void;
  /** Si viene, el formulario edita ese equipo en vez de crear uno nuevo. */
  equipo?: EquipoIt;
}) {
  const esEdicion = equipo !== undefined;
  const [form, setForm] = useState<CrearEquipoInput>(
    equipo ? aFormulario(equipo) : FORMULARIO_VACIO,
  );
  const crear = useCrearEquipo();
  const actualizar = useActualizarEquipo(equipo?.id ?? '');
  const { data: tiposActivos } = useTiposEquipo(true);

  // Los catálogos del ámbito de informática: no se mezclan con los de planta.
  const { marcas, ubicaciones } = useCatalogoIt();
  const modelos = useModelosDeMarca(form.marcaId);
  const crearMarca = useCrearItemCatalogo('marcas-equipo', 'IT');
  const crearUbicacion = useCrearItemCatalogo('ubicaciones-equipo', 'IT');
  const crearModelo = useCrearModelo();

  // Al abrir el alta, se preselecciona el primer tipo del catálogo.
  useEffect(() => {
    if (!esEdicion && !form.tipoId && tiposActivos?.length) {
      setForm((f) => ({ ...f, tipoId: tiposActivos[0].id }));
    }
  }, [tiposActivos, esEdicion, form.tipoId]);
  const guardando = crear.isPending || actualizar.isPending;
  const errorGuardar = crear.error ?? actualizar.error;

  // Si el tipo elegido lleva especificaciones lo dice el catálogo: una cámara
  // o una impresora no tienen procesador ni RAM.
  const conEspecificaciones =
    (tiposActivos ?? []).find((t) => t.id === form.tipoId)?.llevaEspecificaciones ?? true;

  const cambiar = <K extends keyof CrearEquipoInput>(campo: K, valor: CrearEquipoInput[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /** Los campos vacíos no se mandan: el backend rechaza strings vacíos. */
  const limpiar = (input: CrearEquipoInput): CrearEquipoInput => {
    const salida = { ...input };
    for (const clave of Object.keys(salida) as (keyof CrearEquipoInput)[]) {
      const valor = salida[clave];
      if (valor === '' || valor === undefined || Number.isNaN(valor)) delete salida[clave];
    }
    return salida;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esEdicion) {
      await actualizar.mutateAsync(limpiar(form));
    } else {
      await crear.mutateAsync(limpiar(form));
    }
    alCerrar();
  };

  return (
    <Modal
      titulo={esEdicion ? `Editar ${nombreDelEquipo(equipo)}` : 'Nuevo equipo'}
      abierto
      tamano="ancho"
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <div className="grilla-campos">
          <label>
            Tipo *
            <select
              value={form.tipoId}
              onChange={(e) => cambiar('tipoId', e.target.value)}
              required
            >
              {(tiposActivos ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={form.estado ?? 'EN_DEPOSITO'}
              onChange={(e) => cambiar('estado', e.target.value as EstadoEquipoIt)}
            >
              {ESTADOS.map((es) => (
                <option key={es} value={es}>
                  {ETIQUETA_ESTADO[es]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Código interno
            <input
              value={form.codigoInterno ?? ''}
              onChange={(e) => cambiar('codigoInterno', e.target.value)}
              placeholder="IT-0042"
            />
          </label>
          <SelectorCatalogo
            id="equipo-marca"
            etiqueta="Marca"
            valor={form.marcaId ?? ''}
            opciones={marcas.data ?? []}
            creando={crearMarca.isPending}
            onCambiar={(id) => {
              // Cambiar de marca invalida el modelo: un modelo pertenece a una
              // marca, y dejarlo colgado guardaria un par que no existe.
              setForm((f) => ({ ...f, marcaId: id || undefined, modeloId: undefined }));
            }}
            onCrear={async (nombre) => (await crearMarca.mutateAsync({ nombre })).id}
          />
          <SelectorCatalogo
            id="equipo-modelo"
            etiqueta="Modelo"
            valor={form.modeloId ?? ''}
            opciones={modelos.data ?? []}
            deshabilitado={!form.marcaId}
            creando={crearModelo.isPending}
            ayuda={form.marcaId ? undefined : 'Elegí la marca primero: el modelo cuelga de ella.'}
            onCambiar={(id) => cambiar('modeloId', id || undefined)}
            onCrear={async (nombre) =>
              (await crearModelo.mutateAsync({ marcaId: form.marcaId as string, nombre })).id
            }
          />
          <label>
            Nº de serie
            <input
              value={form.numeroSerie ?? ''}
              onChange={(e) => cambiar('numeroSerie', e.target.value)}
            />
          </label>
          <SelectorCatalogo
            id="equipo-ubicacion"
            etiqueta="Ubicación"
            valor={form.ubicacionId ?? ''}
            opciones={ubicaciones.data ?? []}
            creando={crearUbicacion.isPending}
            onCambiar={(id) => cambiar('ubicacionId', id || undefined)}
            onCrear={async (nombre) => (await crearUbicacion.mutateAsync({ nombre })).id}
          />

        </div>

        {conEspecificaciones && (
          <>
            <h3 className="subtitulo-form">Especificaciones</h3>
            <div className="grilla-campos">
              <label>
                Procesador
                <input
                  value={form.procesador ?? ''}
                  onChange={(e) => cambiar('procesador', e.target.value)}
                  placeholder="Intel Core i5-1135G7"
                />
              </label>
              <label>
                Memoria RAM (GB)
                <CampoNumero
                  min={1}
                  valor={form.memoriaRamGb}
                  onCambio={(v) => cambiar('memoriaRamGb', v)}
                />
              </label>
              <label>
                Tipo de disco
                <select
                  value={form.discoTipo ?? ''}
                  onChange={(e) =>
                    cambiar('discoTipo', (e.target.value || undefined) as CrearEquipoInput['discoTipo'])
                  }
                >
                  <option value="">—</option>
                  <option value="HDD">HDD</option>
                  <option value="SSD">SSD</option>
                  <option value="NVME">NVMe</option>
                  <option value="EMMC">eMMC</option>
                </select>
              </label>
              <label>
                Capacidad del disco (GB)
                <CampoNumero
                  min={1}
                  valor={form.discoCapacidadGb}
                  onCambio={(v) => cambiar('discoCapacidadGb', v)}
                />
              </label>
              <label>
                Sistema operativo
                <input
                  value={form.sistemaOperativo ?? ''}
                  onChange={(e) => cambiar('sistemaOperativo', e.target.value)}
                  placeholder="Windows 11 Pro"
                />
              </label>
            </div>
          </>
        )}

        <h3 className="subtitulo-form">Red y acceso remoto</h3>
        <div className="grilla-campos">
          <label>
            Dirección IP
            <input
              value={form.direccionIp ?? ''}
              onChange={(e) => cambiar('direccionIp', e.target.value)}
              placeholder="192.168.1.50"
            />
          </label>
          <label>
            Dirección MAC
            <input
              value={form.direccionMac ?? ''}
              onChange={(e) => cambiar('direccionMac', e.target.value)}
              placeholder="00:1A:2B:3C:4D:5E"
            />
          </label>
          <label>
            Nombre en la red
            <input
              value={form.nombreEnRed ?? ''}
              onChange={(e) => cambiar('nombreEnRed', e.target.value)}
              placeholder="PC-ADMIN-01"
            />
          </label>
          <label>
            Acceso remoto
            <select
              value={form.accesoRemoto ?? 'NINGUNO'}
              onChange={(e) =>
                cambiar('accesoRemoto', e.target.value as CrearEquipoInput['accesoRemoto'])
              }
            >
              {(Object.keys(ETIQUETA_ACCESO) as (keyof typeof ETIQUETA_ACCESO)[]).map((a) => (
                <option key={a} value={a}>
                  {ETIQUETA_ACCESO[a]}
                </option>
              ))}
            </select>
          </label>
          {form.accesoRemoto && form.accesoRemoto !== 'NINGUNO' && (
            <label>
              ID de acceso remoto
              <input
                value={form.accesoRemotoId ?? ''}
                onChange={(e) => cambiar('accesoRemotoId', e.target.value)}
                placeholder="123 456 789"
              />
            </label>
          )}
        </div>

        <h3 className="subtitulo-form">Compra y garantía</h3>
        <div className="grilla-campos">
          <label>
            Fecha de compra
            <input
              type="date"
              value={form.fechaCompra?.slice(0, 10) ?? ''}
              onChange={(e) =>
                cambiar('fechaCompra', e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined)
              }
            />
          </label>
          <label>
            Garantía hasta
            <input
              type="date"
              value={form.garantiaHasta?.slice(0, 10) ?? ''}
              onChange={(e) =>
                cambiar(
                  'garantiaHasta',
                  e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined,
                )
              }
            />
          </label>
        </div>

        <label>
          Notas
          <textarea
            rows={2}
            value={form.notas ?? ''}
            onChange={(e) => cambiar('notas', e.target.value)}
          />
        </label>

        {errorGuardar && <MensajeError error={errorGuardar} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar equipo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────── Detalle ───────────────────────────

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null }) {
  if (valor === null || valor === '' || valor === undefined) return null;
  return (
    <div className="dato">
      <span className="texto-suave texto-chico">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}

function ModalDetalleEquipo({
  equipo,
  alCerrar,
  alEditar,
}: {
  equipo: EquipoIt;
  alCerrar: () => void;
  alEditar: () => void;
}) {
  const { data: historial } = useAsignacionesEquipo(equipo.id);
  const eliminar = useEliminarEquipo();

  return (
    <Modal titulo={nombreDelEquipo(equipo)} abierto tamano="ancho" onCerrar={alCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <Dato etiqueta="Código interno" valor={equipo.codigoInterno} />
          <Dato etiqueta="Tipo" valor={equipo.tipoNombre} />
          <Dato etiqueta="Estado" valor={ETIQUETA_ESTADO[equipo.estado]} />
          <Dato etiqueta="Nº de serie" valor={equipo.numeroSerie} />
          <Dato etiqueta="Marca" valor={equipo.marcaNombre} />
          <Dato etiqueta="Modelo" valor={equipo.modeloNombre} />
          <Dato etiqueta="Ubicación" valor={equipo.ubicacionNombre} />
          <Dato etiqueta="Responsable" valor={equipo.responsableNombre ?? 'Depósito'} />
        </div>

        {(equipo.procesador || equipo.memoriaRamGb || equipo.discoCapacidadGb) && (
          <>
            <h3 className="subtitulo-form">Especificaciones</h3>
            <div className="grilla-datos">
              <Dato etiqueta="Procesador" valor={equipo.procesador} />
              <Dato
                etiqueta="Memoria RAM"
                valor={equipo.memoriaRamGb ? `${equipo.memoriaRamGb} GB` : null}
              />
              <Dato
                etiqueta="Disco"
                valor={
                  equipo.discoCapacidadGb
                    ? `${equipo.discoCapacidadGb} GB ${equipo.discoTipo ?? ''}`.trim()
                    : null
                }
              />
              <Dato etiqueta="Sistema operativo" valor={equipo.sistemaOperativo} />
            </div>
          </>
        )}

        {(equipo.direccionIp || equipo.nombreEnRed || equipo.accesoRemoto !== 'NINGUNO') && (
          <>
            <h3 className="subtitulo-form">Red y acceso remoto</h3>
            <div className="grilla-datos">
              <Dato etiqueta="Dirección IP" valor={equipo.direccionIp} />
              <Dato etiqueta="Dirección MAC" valor={equipo.direccionMac} />
              <Dato etiqueta="Nombre en la red" valor={equipo.nombreEnRed} />
              <Dato etiqueta="Acceso remoto" valor={ETIQUETA_ACCESO[equipo.accesoRemoto]} />
              <Dato etiqueta="ID de acceso" valor={equipo.accesoRemotoId} />
            </div>
          </>
        )}

        {(equipo.proveedorNombre || equipo.fechaCompra || equipo.garantiaHasta) && (
          <>
            <h3 className="subtitulo-form">Compra</h3>
            <div className="grilla-datos">
              <Dato etiqueta="Proveedor" valor={equipo.proveedorNombre} />
              <Dato
                etiqueta="Fecha de compra"
                valor={equipo.fechaCompra ? formatearFechaSola(equipo.fechaCompra) : null}
              />
              <Dato
                etiqueta="Garantía hasta"
                valor={
                  equipo.garantiaHasta
                    ? `${formatearFechaSola(equipo.garantiaHasta)}${equipo.garantiaVencida ? ' (vencida)' : ''}`
                    : null
                }
              />
            </div>
          </>
        )}

        {equipo.notas && (
          <>
            <h3 className="subtitulo-form">Notas</h3>
            <p className="texto-suave">{equipo.notas}</p>
          </>
        )}

        <h3 className="subtitulo-form">Quién tuvo este equipo</h3>
        {!historial?.length && <p className="texto-suave">Sin movimientos registrados.</p>}
        {!!historial?.length && (
          <ul className="linea-tiempo">
            {historial.map((a) => (
              <li key={a.id}>
                <strong>{a.responsableNombre ?? 'Depósito'}</strong>
                {a.vigente && <span className="badge badge-ok">Actual</span>}
                <div className="texto-suave texto-chico">
                  Desde {formatearFecha(a.desde)}
                  {a.hasta ? ` hasta ${formatearFecha(a.hasta)}` : ''}
                  {a.motivo ? ` · ${a.motivo}` : ''}
                  {a.registradoPorNombre ? ` · registró ${a.registradoPorNombre}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Muchas de estas maquinas tienen clave de ingreso: el inicio de
            sesion de la PC, el acceso a una grabadora. Aca se ven las que le
            pertenecen, que es donde alguien parado frente al equipo las va a
            buscar. Los valores no: para eso hay que pedirlos desde el baul y
            queda registrado quien los miro. */}
        <CredencialesDelEquipo equipoItId={equipo.id} />

        {eliminar.error && <MensajeError error={eliminar.error} />}

        <div className="acciones">
          <button className="btn btn-primario" onClick={alEditar}>
            ✏️ Editar
          </button>
          <button
            className="btn btn-peligro"
            disabled={eliminar.isPending}
            onClick={async () => {
              if (!confirm(`¿Eliminar ${nombreDelEquipo(equipo)}? Esta acción no se deshace.`))
                return;
              await eliminar.mutateAsync(equipo.id);
              alCerrar();
            }}
          >
            Eliminar
          </button>
          <button className="btn" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────── Asignación ───────────────────────────

function ModalAsignar({ equipo, alCerrar }: { equipo: EquipoIt; alCerrar: () => void }) {
  // Responsables, NO usuarios del sistema: quien tiene el equipo casi nunca
  // entra al sistema, y a veces ni siquiera es una persona.
  const { data: responsables } = useResponsables(true);
  const crearResponsable = useCrearResponsable();
  const asignar = useAsignarEquipo(equipo.id);
  const [responsableId, setResponsableId] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  const opciones = useMemo(() => responsables ?? [], [responsables]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await asignar.mutateAsync({
      responsableId: responsableId || null,
      motivo: motivo || undefined,
    });
    alCerrar();
  };

  return (
    <Modal titulo={`¿Quién tiene ${nombreDelEquipo(equipo)}?`} abierto onCerrar={alCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <p className="texto-suave">
          Actualmente: <strong>{equipo.responsableNombre ?? 'en depósito'}</strong>
        </p>

        <SelectorCatalogo
          id="asignar-responsable"
          etiqueta="Queda a cargo de"
          valor={responsableId}
          opciones={opciones}
          creando={crearResponsable.isPending}
          placeholder="— Devolver a depósito —"
          placeholderNuevo="Nombre de la persona o del sector"
          ayuda="Puede ser una persona o un sector. No es un usuario del sistema."
          onCambiar={setResponsableId}
          onCrear={async (nombre) => (await crearResponsable.mutateAsync({ nombre })).id}
        />

        <label>
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ingreso de personal, cambio de sector, reparación…"
            minLength={3}
          />
        </label>

        {asignar.error && <MensajeError error={asignar.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={asignar.isPending}>
            {asignar.isPending ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
