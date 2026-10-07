import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEquipo, useEquipos, useResumenEquipos, useTiposEquipo } from '@/api/equiposIt';
import { useCatalogoIt } from '@/api/catalogosEquipo';
import { useResponsables } from '@/api/responsables';
import { AccionesFila } from '@/componentes/AccionesFila';
import { EtiquetasQrEquiposIt } from '@/componentes/EtiquetasQrEquiposIt';
import { ResponsablesEquipo } from '@/componentes/ResponsablesEquipo';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { ImportarEquipos } from '@/componentes/ImportarEquipos';
import { TiposEquipo } from '@/componentes/TiposEquipo';
import { ETIQUETA_ESTADO } from '@/tipos/equipoIt';
import type { EquipoIt, EstadoEquipoIt } from '@/tipos/equipoIt';
import { ESTADOS, nombreDelEquipo } from '@/componentes/equiposIt/comun';
import { ModalAltaEquipo } from '@/componentes/equiposIt/ModalAltaEquipo';
import { ModalDetalleEquipo } from '@/componentes/equiposIt/ModalDetalleEquipo';
import { ModalAsignar } from '@/componentes/equiposIt/ModalAsignar';

const LIMITE = 20;

/** Clase del badge según el estado, para que se lea de un vistazo. */
const CLASE_ESTADO: Record<EstadoEquipoIt, string> = {
  EN_USO: 'badge badge-ok',
  EN_DEPOSITO: 'badge',
  EN_REPARACION: 'badge badge-aviso',
  DADO_DE_BAJA: 'badge badge-error',
};

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
  const [modalEtiquetas, setModalEtiquetas] = useState(false);

  // El QR pegado en el equipo lleva a /equipos-it?equipo=<id>. Sin esto la
  // dirección abría el listado y no la ficha, que es lo que necesita ver el que
  // escaneó la etiqueta parado delante de la máquina.
  const [parametros, setParametros] = useSearchParams();
  const idPedido = parametros.get('equipo') ?? '';
  const equipoPedido = useEquipo(idPedido);

  useEffect(() => {
    if (equipoPedido.data) setEquipoDetalle(equipoPedido.data);
  }, [equipoPedido.data]);

  /** Cierra la ficha y saca el id de la dirección, para que no vuelva a abrirse. */
  const cerrarDetalle = () => {
    setEquipoDetalle(null);
    if (idPedido) {
      parametros.delete('equipo');
      setParametros(parametros, { replace: true });
    }
  };

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
          <button className="btn" onClick={() => setModalEtiquetas(true)}>
            🏷 Etiquetas QR
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
      {modalEtiquetas && <EtiquetasQrEquiposIt onCerrar={() => setModalEtiquetas(false)} />}
      <TiposEquipo abierto={modalTipos} onCerrar={() => setModalTipos(false)} />
      {modalResponsables && <ResponsablesEquipo onCerrar={() => setModalResponsables(false)} />}
      {modalAlta && <ModalAltaEquipo alCerrar={() => setModalAlta(false)} />}
      {equipoEditar && (
        <ModalAltaEquipo equipo={equipoEditar} alCerrar={() => setEquipoEditar(null)} />
      )}
      {equipoDetalle && (
        <ModalDetalleEquipo
          equipo={equipoDetalle}
          alCerrar={cerrarDetalle}
          alEditar={() => {
            const e = equipoDetalle;
            cerrarDetalle();
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
