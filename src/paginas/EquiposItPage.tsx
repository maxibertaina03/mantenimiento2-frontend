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
  useUbicaciones,
} from '@/api/equiposIt';
import { useUsuarios } from '@/api/usuarios';
import { AccionesFila } from '@/componentes/AccionesFila';
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
  marca: '',
  modelo: '',
};

export function EquiposItPage() {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [estado, setEstado] = useState<EstadoEquipoIt | ''>('');

  const [modalAlta, setModalAlta] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalTipos, setModalTipos] = useState(false);
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
  });
  const { data: tiposCatalogo } = useTiposEquipo();
  const { data: resumen } = useResumenEquipos();

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
                <th>Asignado a</th>
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
                    <strong>{equipo.marca}</strong> {equipo.modelo}
                    {equipo.direccionIp && (
                      <div className="texto-suave texto-chico">{equipo.direccionIp}</div>
                    )}
                  </td>
                  <td data-etiqueta="Asignado a">
                    {equipo.asignadoANombre ?? <span className="texto-suave">Depósito</span>}
                  </td>
                  <td data-etiqueta="Ubicación">{equipo.ubicacion ?? '—'}</td>
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
                        descripcion={`${equipo.marca} ${equipo.modelo}`}
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
    marca: equipo.marca,
    modelo: equipo.modelo,
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
    ubicacion: equipo.ubicacion ?? undefined,
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
  const { data: ubicaciones } = useUbicaciones();
  const { data: tiposActivos } = useTiposEquipo(true);

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
      titulo={esEdicion ? `Editar ${equipo.marca} ${equipo.modelo}` : 'Nuevo equipo'}
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
          <label>
            Marca *
            <input
              value={form.marca}
              onChange={(e) => cambiar('marca', e.target.value)}
              required
              minLength={2}
              placeholder="Dell"
            />
          </label>
          <label>
            Modelo *
            <input
              value={form.modelo}
              onChange={(e) => cambiar('modelo', e.target.value)}
              required
              placeholder="Latitude 5420"
            />
          </label>
          <label>
            Nº de serie
            <input
              value={form.numeroSerie ?? ''}
              onChange={(e) => cambiar('numeroSerie', e.target.value)}
            />
          </label>
          <label>
            Ubicación
            {/* datalist: sugiere las ubicaciones ya usadas pero deja escribir
                una nueva. No es un catálogo cerrado. */}
            <input
              value={form.ubicacion ?? ''}
              onChange={(e) => cambiar('ubicacion', e.target.value)}
              placeholder="Oficina administración"
              list="ubicaciones-equipos"
            />
            <datalist id="ubicaciones-equipos">
              {(ubicaciones ?? []).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
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
    <Modal titulo={`${equipo.marca} ${equipo.modelo}`} abierto tamano="ancho" onCerrar={alCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <Dato etiqueta="Código interno" valor={equipo.codigoInterno} />
          <Dato etiqueta="Tipo" valor={equipo.tipoNombre} />
          <Dato etiqueta="Estado" valor={ETIQUETA_ESTADO[equipo.estado]} />
          <Dato etiqueta="Nº de serie" valor={equipo.numeroSerie} />
          <Dato etiqueta="Ubicación" valor={equipo.ubicacion} />
          <Dato etiqueta="Asignado a" valor={equipo.asignadoANombre ?? 'Depósito'} />
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

        <h3 className="subtitulo-form">Historial de asignaciones</h3>
        {!historial?.length && <p className="texto-suave">Sin movimientos registrados.</p>}
        {!!historial?.length && (
          <ul className="linea-tiempo">
            {historial.map((a) => (
              <li key={a.id}>
                <strong>{a.usuarioNombre ?? 'Depósito'}</strong>
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

        {eliminar.error && <MensajeError error={eliminar.error} />}

        <div className="acciones">
          <button className="btn btn-primario" onClick={alEditar}>
            ✏️ Editar
          </button>
          <button
            className="btn btn-peligro"
            disabled={eliminar.isPending}
            onClick={async () => {
              if (!confirm(`¿Eliminar ${equipo.marca} ${equipo.modelo}? Esta acción no se deshace.`))
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
  const { data: usuarios } = useUsuarios(1, 100);
  const asignar = useAsignarEquipo(equipo.id);
  const [usuarioId, setUsuarioId] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  // Devolver a depósito es elegir "sin asignar".
  const opciones = useMemo(() => usuarios?.datos ?? [], [usuarios]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await asignar.mutateAsync({
      usuarioId: usuarioId || null,
      motivo: motivo || undefined,
    });
    alCerrar();
  };

  return (
    <Modal titulo={`Asignar ${equipo.marca} ${equipo.modelo}`} abierto onCerrar={alCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <p className="texto-suave">
          Actualmente: <strong>{equipo.asignadoANombre ?? 'en depósito'}</strong>
        </p>

        <label>
          Asignar a
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">— Devolver a depósito —</option>
            {opciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

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
