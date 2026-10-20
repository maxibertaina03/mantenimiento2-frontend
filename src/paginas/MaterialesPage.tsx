import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Plus,
  QrCode,
  Ruler,
  Settings,
  SlidersHorizontal,
  Tags,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  obtenerTodosLosMateriales,
  useEliminarMaterial,
  useJubilarMaterial,
  useMateriales,
} from '@/api/materiales';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { MenuDesplegable } from '@/componentes/MenuDesplegable';
import { AccionesFila } from '@/componentes/AccionesFila';
import { CategoriasMaterial } from '@/componentes/CategoriasMaterial';
import { UnidadesMedida } from '@/componentes/UnidadesMedida';
import { FiltrosMateriales, contarFiltros } from '@/componentes/FiltrosMateriales';
import type { FiltrosMateriales as Filtros } from '@/api/materiales';
import { FormularioMaterial } from '@/componentes/FormularioMaterial';
import { EtiquetasQrMateriales } from '@/componentes/EtiquetasQrMateriales';
import { EstanteriasMaterial } from '@/componentes/EstanteriasMaterial';
import { Modal } from '@/componentes/Modal';
import { descargarCsv, generarCsv, sufijoFechaArchivo } from '@/lib/csv';
import { exportarPdf } from '@/lib/pdf';
import { formatearNumero } from '@/lib/formato';
import type { Material } from '@/tipos/material';
import { tieneMouse } from '@/lib/dispositivo';
import {
  estadoParaVolver,
  useBusquedaDemorada,
  useListaEnUrl,
  type EsquemaFiltros,
} from '@/lib/listaEnUrl';

const LIMITE = 20;

/** Los filtros que van en la dirección, y de qué tipo es cada uno. */
const ESQUEMA: EsquemaFiltros<Filtros> = {
  buscar: 'texto',
  categoriaId: 'texto',
  unidadId: 'texto',
  stockMin: 'numero',
  stockMax: 'numero',
  bajoStock: 'si',
  sinUnidad: 'si',
  mostrar: 'texto',
  sinQr: 'si',
  estanteriaId: 'texto',
  sinUbicacion: 'si',
  ordenarPor: 'texto',
  direccion: 'texto',
};

/** Unidades que se ofrecen aunque todavía no las use ningún material. */
export function MaterialesPage() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const eliminar = useEliminarMaterial();
  const jubilar = useJubilarMaterial();

  // Los filtros, la búsqueda y la página viven en la dirección: entrar a un
  // material y volver deja la lista como estaba («Electricidad», página 4).
  const { filtros: filtrosConBusqueda, pagina, cambiarFiltros, reemplazarFiltros, irAPagina } =
    useListaEnUrl<Filtros>(ESQUEMA);
  const { buscar: busquedaDebounced = '', ...filtros } = filtrosConBusqueda;
  const [buscar, setBuscar] = useBusquedaDemorada(busquedaDebounced, (b) =>
    cambiarFiltros({ buscar: b }),
  );
  // Si se vuelve con filtros puestos, el panel aparece abierto: que se vea qué filtra.
  const [panelFiltros, setPanelFiltros] = useState(() => contarFiltros(filtros) > 0);
  /** Abre la ficha recordando la lista como está, para que «← Volver» la deje igual. */
  const abrir = (id: string) =>
    navegar(`/materiales/${id}`, { state: estadoParaVolver(ubicacion) });

  const { data, isLoading, error, isFetching } = useMateriales(pagina, LIMITE, filtrosConBusqueda);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Material | null>(null);
  const [modalCategorias, setModalCategorias] = useState(false);
  const [etiquetas, setEtiquetas] = useState(false);
  const [modalEstanterias, setModalEstanterias] = useState(false);
  const [modalUnidades, setModalUnidades] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  const exportar = async (formato: 'csv' | 'pdf') => {
    setErrorExport(null);
    setExportando(true);
    try {
      const todos = await obtenerTodosLosMateriales();
      const encabezados = [
        'Material',
        'Categoría',
        'Unidad',
        'Stock actual',
        'Stock mínimo',
        'Bajo stock',
        'Notas',
      ];
      const filas = todos.map((m) => [
        m.nombre,
        m.categoriaNombre ?? '',
        m.unidad,
        formatearNumero(m.stockActual),
        formatearNumero(m.stockMinimo),
        m.bajoStock ? 'SÍ' : 'NO',
        m.notas ?? '',
      ]);

      if (formato === 'csv') {
        descargarCsv(`materiales_stock_${sufijoFechaArchivo()}.csv`, generarCsv(encabezados, filas));
      } else {
        const bajos = todos.filter((m) => m.bajoStock).length;
        await exportarPdf({
          titulo: 'Materiales en stock',
          subtitulo: `${todos.length} material(es)`,
          encabezados,
          filas,
          nombreArchivo: `materiales_stock_${sufijoFechaArchivo()}.pdf`,
          orientacion: 'landscape',
          resaltarFilas: todos.map((m) => m.bajoStock),
          leyenda: bajos > 0 ? `${bajos} bajo stock (resaltados)` : 'Todo OK',
        });
      }
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo exportar.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Materiales</h1>
          <p>
            {data ? `${formatearNumero(data.total)} materiales` : 'El pañol'}
            {' · '}stock, ubicación y lo que hay que reponer
          </p>
        </div>
        {/* Lo que se usa poco va en menús: eran siete botones y el que
            importa, «Nuevo material», se perdía entre los demás. */}
        <div className="acciones-cabecera">
          <MenuDesplegable
            texto={exportando ? 'Exportando…' : 'Exportar'}
            Icono={Download}
            deshabilitado={exportando}
            opciones={[
              { texto: 'Planilla (CSV)', Icono: FileSpreadsheet, onElegir: () => exportar('csv') },
              { texto: 'PDF', Icono: FileText, onElegir: () => exportar('pdf') },
            ]}
          />
          <button className="btn" onClick={() => setEtiquetas(true)}>
            <QrCode className="icono" aria-hidden />
            Etiquetas QR
          </button>
          <MenuDesplegable
            texto="Configurar"
            Icono={Settings}
            opciones={[
              { texto: 'Categorías', Icono: Tags, onElegir: () => setModalCategorias(true) },
              { texto: 'Unidades', Icono: Ruler, onElegir: () => setModalUnidades(true) },
              {
                texto: 'Estanterías',
                Icono: Warehouse,
                onElegir: () => setModalEstanterias(true),
              },
            ]}
          />
          <button className="btn btn-primario" onClick={() => setModalAbierto(true)}>
            <Plus className="icono" aria-hidden />
            Nuevo material
          </button>
        </div>
      </div>

      {/* Buscador rápido por nombre */}
      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar material por nombre…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          // Solo con mouse: en el celular abriría el teclado apenas se entra.
          autoFocus={tieneMouse()}
        />
        <button
          className={contarFiltros(filtros) > 0 ? 'btn btn-primario' : 'btn'}
          onClick={() => setPanelFiltros((v) => !v)}
        >
          <SlidersHorizontal className="icono" aria-hidden />
          Filtros{contarFiltros(filtros) > 0 ? ` (${contarFiltros(filtros)})` : ''}
        </button>
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      {panelFiltros && (
        <FiltrosMateriales
          filtros={filtros}
          // Vuelve a la página 1: con el filtro nuevo, la de antes puede no
          // existir y la tabla saldría vacía.
          onCambio={(f) => reemplazarFiltros({ ...f, buscar: busquedaDebounced })}
        />
      )}

      {errorExport && <MensajeError error={new Error(errorExport)} />}

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}

      {data && (
        <div className="tabla-scroll tabla-cards-contenedor">
        <table className="tabla tabla-cards">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="num">Stock actual</th>
              <th className="num">Stock mínimo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.datos.map((m) => (
              <tr
                key={m.id}
                className="fila-clickeable"
                onClick={() => abrir(m.id)}
              >
                <td data-etiqueta="Material">
                  <div className="nombre-con-foto">
                    {m.fotoUrl ? (
                      <img src={m.fotoUrl} alt="" className="miniatura-material" loading="lazy" />
                    ) : (
                      <span className="miniatura-material miniatura-vacia" aria-hidden>
                        <ImageIcon />
                      </span>
                    )}
                    {/* Solo el nombre es el enlace: así se lee «Cable 2,5 mm» y no
                        también dónde está guardado. */}
                    <span className="nombre-y-lugar">
                      <Link
                        to={`/materiales/${m.id}`}
                        state={estadoParaVolver(ubicacion)}
                        onClick={(e) => e.stopPropagation()}
                        className="nombre-material"
                      >
                        {m.nombre}
                      </Link>
                      <span className="lugar-material">
                        {m.estanteriaNombre
                          ? `Estantería ${m.estanteriaNombre}${m.fila ? ` · fila ${m.fila}` : ''}`
                          : 'Sin ubicar'}
                      </span>
                    </span>
                  </div>
                </td>
                <td data-etiqueta="Categoría">{m.categoriaNombre ?? '—'}</td>
                <td data-etiqueta="Unidad">{m.unidad || '—'}</td>
                <td className="num" data-etiqueta="Stock actual">
                  {formatearNumero(m.stockActual)}
                </td>
                <td className="num" data-etiqueta="Stock mínimo">
                  {formatearNumero(m.stockMinimo)}
                </td>
                <td data-etiqueta="Estado">
                  {/* Jubilado primero: si esta fuera de circulacion, que le
                      falte stock es lo de menos. */}
                  {!m.activo ? (
                    <span className="badge">Fuera de circulación</span>
                  ) : m.bajoStock ? (
                    <span className="badge badge-bajo">Bajo stock</span>
                  ) : (
                    <span className="badge badge-ok">OK</span>
                  )}
                </td>
                {/* stopPropagation: los botones no deben navegar al detalle. */}
                <td className="celda-acciones" onClick={(e) => e.stopPropagation()}>
                  <AccionesFila
                    descripcion={m.nombre}
                    jubilado={!m.activo}
                    onVer={() => abrir(m.id)}
                    onEditar={() => setEditando(m)}
                    onJubilar={() => {
                      // Lo que hay que hacer con casi todo lo que ya se usó:
                      // sale de las listas y el historial queda.
                      const aviso = m.activo
                        ? `¿Sacar "${m.nombre}" de circulación?

Deja de aparecer al cargar ` +
                          'movimientos y órdenes, pero se conserva todo lo registrado.'
                        : `¿Devolver "${m.nombre}" a circulación?`;
                      if (confirm(aviso)) jubilar.mutate({ id: m.id, activo: !m.activo });
                    }}
                    onEliminar={() => {
                      if (confirm(`¿Eliminar el material "${m.nombre}"?`)) eliminar.mutate(m.id);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busquedaDebounced
            ? `No se encontraron materiales para «${busquedaDebounced}».`
            : 'No hay materiales cargados todavía.'}
        </EstadoVacio>
      )}

      {/* Paginación */}
      {data && data.total > LIMITE && (
        <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="texto-suave">{data.total} material(es)</span>
          <div className="fila-acciones">
            <button
              className="btn btn-sm"
              disabled={pagina <= 1}
              onClick={() => irAPagina(pagina - 1)}
            >
              <ChevronLeft className="icono" aria-hidden />
              Anterior
            </button>
            <span className="texto-suave" style={{ padding: '0 0.5rem' }}>
              Página {pagina} de {totalPaginas}
            </span>
            <button
              className="btn btn-sm"
              disabled={pagina >= totalPaginas}
              onClick={() => irAPagina(pagina + 1)}
            >
              Siguiente
              <ChevronRight className="icono" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <Modal
        titulo={editando ? `Editar ${editando.nombre}` : 'Nuevo material'}
        abierto={modalAbierto || editando !== null}
        onCerrar={() => {
          setModalAbierto(false);
          setEditando(null);
        }}
      >
        {/* key: remonta el formulario al cambiar de material, para que no
            conserve los valores del anterior. */}
        <FormularioMaterial
          key={editando?.id ?? 'nuevo'}
          material={editando ?? undefined}
          onListo={() => {
            setModalAbierto(false);
            setEditando(null);
          }}
        />
      </Modal>

      {etiquetas && <EtiquetasQrMateriales onCerrar={() => setEtiquetas(false)} />}

      <EstanteriasMaterial
        abierto={modalEstanterias}
        onCerrar={() => setModalEstanterias(false)}
      />

      <CategoriasMaterial
        abierto={modalCategorias}
        onCerrar={() => setModalCategorias(false)}
      />

      <UnidadesMedida abierto={modalUnidades} onCerrar={() => setModalUnidades(false)} />
    </>
  );
}

/**
 * Mismo formulario para dar de alta y para editar. Mantener dos copias
 * garantizaba que se desincronizaran al agregar un campo.
 */
