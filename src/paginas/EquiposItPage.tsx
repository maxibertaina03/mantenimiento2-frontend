import { useEffect, useMemo, useState } from 'react';
import {
  useAsignacionesEquipo,
  useAsignarEquipo,
  useCrearEquipo,
  useEliminarEquipo,
  useEquipos,
  useResumenEquipos,
} from '@/api/equiposIt';
import { useUsuarios } from '@/api/usuarios';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearFechaSola } from '@/lib/formato';
import {
  ETIQUETA_ACCESO,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  requiereEspecificacionesDePc,
} from '@/tipos/equipoIt';
import type {
  CrearEquipoInput,
  EquipoIt,
  EstadoEquipoIt,
  TipoEquipoIt,
} from '@/tipos/equipoIt';

const LIMITE = 20;

const TIPOS = Object.keys(ETIQUETA_TIPO) as TipoEquipoIt[];
const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoEquipoIt[];

/** Clase del badge según el estado, para que se lea de un vistazo. */
const CLASE_ESTADO: Record<EstadoEquipoIt, string> = {
  EN_USO: 'badge badge-ok',
  EN_DEPOSITO: 'badge',
  EN_REPARACION: 'badge badge-aviso',
  DADO_DE_BAJA: 'badge badge-error',
};

const FORMULARIO_VACIO: CrearEquipoInput = {
  tipo: 'PC',
  marca: '',
  modelo: '',
};

export function EquiposItPage() {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [tipo, setTipo] = useState<TipoEquipoIt | ''>('');
  const [estado, setEstado] = useState<EstadoEquipoIt | ''>('');

  const [modalAlta, setModalAlta] = useState(false);
  const [equipoDetalle, setEquipoDetalle] = useState<EquipoIt | null>(null);
  const [equipoAsignar, setEquipoAsignar] = useState<EquipoIt | null>(null);

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
    tipo,
    estado,
  });
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
        <button className="btn btn-primario" onClick={() => setModalAlta(true)}>
          + Nuevo equipo
        </button>
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
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoEquipoIt | '');
            setPagina(1);
          }}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
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
          {busquedaDebounced || tipo || estado
            ? 'No hay equipos que coincidan con el filtro.'
            : 'Todavía no cargaste ningún equipo.'}
        </EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
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
                  <td>{equipo.codigoInterno ?? '—'}</td>
                  <td>{ETIQUETA_TIPO[equipo.tipo]}</td>
                  <td>
                    <strong>{equipo.marca}</strong> {equipo.modelo}
                    {equipo.direccionIp && (
                      <div className="texto-suave texto-chico">{equipo.direccionIp}</div>
                    )}
                  </td>
                  <td>{equipo.asignadoANombre ?? <span className="texto-suave">Depósito</span>}</td>
                  <td>{equipo.ubicacion ?? '—'}</td>
                  <td>
                    <span className={CLASE_ESTADO[equipo.estado]}>
                      {ETIQUETA_ESTADO[equipo.estado]}
                    </span>
                    {equipo.garantiaVencida && (
                      <div className="texto-suave texto-chico">Garantía vencida</div>
                    )}
                  </td>
                  <td className="fila-acciones-celda">
                    <button className="btn btn-sm" onClick={() => setEquipoDetalle(equipo)}>
                      Ver
                    </button>
                    <button className="btn btn-sm" onClick={() => setEquipoAsignar(equipo)}>
                      Asignar
                    </button>
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

      {modalAlta && <ModalAltaEquipo alCerrar={() => setModalAlta(false)} />}
      {equipoDetalle && (
        <ModalDetalleEquipo equipo={equipoDetalle} alCerrar={() => setEquipoDetalle(null)} />
      )}
      {equipoAsignar && (
        <ModalAsignar equipo={equipoAsignar} alCerrar={() => setEquipoAsignar(null)} />
      )}
    </div>
  );
}

// ─────────────────────────── Alta ───────────────────────────

function ModalAltaEquipo({ alCerrar }: { alCerrar: () => void }) {
  const [form, setForm] = useState<CrearEquipoInput>(FORMULARIO_VACIO);
  const crear = useCrearEquipo();

  // Una cámara o un monitor no llevan procesador/RAM/disco.
  const conEspecificaciones = requiereEspecificacionesDePc(form.tipo);

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
    await crear.mutateAsync(limpiar(form));
    alCerrar();
  };

  return (
    <Modal titulo="Nuevo equipo" abierto tamano="ancho" onCerrar={alCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <div className="grilla-campos">
          <label>
            Tipo *
            <select
              value={form.tipo}
              onChange={(e) => cambiar('tipo', e.target.value as TipoEquipoIt)}
              required
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
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
            <input
              value={form.ubicacion ?? ''}
              onChange={(e) => cambiar('ubicacion', e.target.value)}
              placeholder="Oficina administración"
            />
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
                <input
                  type="number"
                  min={1}
                  value={form.memoriaRamGb ?? ''}
                  onChange={(e) =>
                    cambiar('memoriaRamGb', e.target.value ? Number(e.target.value) : undefined)
                  }
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
                <input
                  type="number"
                  min={1}
                  value={form.discoCapacidadGb ?? ''}
                  onChange={(e) =>
                    cambiar('discoCapacidadGb', e.target.value ? Number(e.target.value) : undefined)
                  }
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

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Guardar equipo'}
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

function ModalDetalleEquipo({ equipo, alCerrar }: { equipo: EquipoIt; alCerrar: () => void }) {
  const { data: historial } = useAsignacionesEquipo(equipo.id);
  const eliminar = useEliminarEquipo();

  return (
    <Modal titulo={`${equipo.marca} ${equipo.modelo}`} abierto tamano="ancho" onCerrar={alCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <Dato etiqueta="Código interno" valor={equipo.codigoInterno} />
          <Dato etiqueta="Tipo" valor={ETIQUETA_TIPO[equipo.tipo]} />
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
