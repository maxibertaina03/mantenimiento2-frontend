import { useEffect, useState } from 'react';
import {
  useAnularOrden,
  useCrearOrden,
  useEliminarOrden,
  useEmitirOrden,
  useEmitirOrdenPorId,
  useOrdenes,
  useRecibirOrden,
} from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { NuevoMaterialRapido } from '@/componentes/NuevoMaterialRapido';
import { ComboProveedor } from '@/componentes/ComboProveedor';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { useTraerMaterial } from '@/api/materiales';
import { useEscaneoSuelto } from '@/lib/escaneo';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { ComprobantesOrden } from '@/componentes/ComprobantesOrden';
import { EnviarOrden } from '@/componentes/EnviarOrden';
import { ETIQUETA_ESTADO_ORDEN } from '@/tipos/ordenCompra';
import type {
  EstadoOrdenCompra,
  OrdenCompra,
  RenglonInput,
} from '@/tipos/ordenCompra';
import type { Material } from '@/tipos/material';
import { P, usePuede } from '@/lib/permisos';

const LIMITE = 20;
const ESTADOS = Object.keys(ETIQUETA_ESTADO_ORDEN) as EstadoOrdenCompra[];

const CLASE_ESTADO: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'badge',
  EMITIDA: 'badge badge-aviso',
  RECIBIDA: 'badge badge-ok',
  ANULADA: 'badge badge-error',
};

function moneda(valor: number | null): string {
  if (valor === null) return '—';
  return `$ ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Con qué papel llegó la mercadería.
 *
 * Una orden se cierra con remito o con factura, así que puede tener uno, el
 * otro, o los dos. Se muestran los que haya y no se inventa un guion cuando la
 * orden todavía no llegó: ahí no hay comprobante porque no tiene que haberlo.
 */
function comprobanteDe(orden: OrdenCompra): string {
  const partes = [
    orden.remito ? `Remito ${orden.remito}` : '',
    orden.factura ? `Factura ${orden.factura}` : '',
  ].filter(Boolean);
  return partes.join(' · ') || '—';
}

export function OrdenesCompraPage() {
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [estado, setEstado] = useState<EstadoOrdenCompra | ''>('');
  const [modalAlta, setModalAlta] = useState(false);
  const [ordenAbierta, setOrdenAbierta] = useState<OrdenCompra | null>(null);
  const [ordenAEnviar, setOrdenAEnviar] = useState<OrdenCompra | null>(null);
  // Mandarle la orden a un tercero usando la casilla de la empresa no es lo
  // mismo que prepararla, por eso tiene permiso propio. Quien no lo tenga
  // sigue con el flujo de siempre: descargar el PDF y mandarlo por su cuenta.
  const puede = usePuede();
  const puedeEnviar = puede(P.ORDENES_ENVIAR);

  /**
   * Abre la pantalla de envío y cierra la que estaba.
   *
   * Cerrar las otras es la parte que importa: la de envío se abre desde el
   * detalle y desde el alta, y dejar las dos abiertas las apilaba una encima de
   * otra. Cuál tapaba a cuál dependía del orden en el JSX, no de lo que la
   * persona acababa de tocar, así que el botón parecía no hacer nada.
   */
  const alEnviar = puedeEnviar
    ? (orden: OrdenCompra) => {
        setOrdenAbierta(null);
        setModalAlta(false);
        setOrdenAEnviar(orden);
      }
    : undefined;

  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, error } = useOrdenes(pagina, LIMITE, busquedaDebounced, estado);
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Órdenes de compra</h1>
        <button className="btn btn-primario" onClick={() => setModalAlta(true)}>
          + Nueva orden
        </button>
      </div>

      <div className="grilla-filtros">
        <input
          type="search"
          placeholder="🔍 Buscar por orden, proveedor, remito o factura…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as EstadoOrdenCompra | '');
            setPagina(1);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_ORDEN[e]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busquedaDebounced || estado
            ? 'No hay órdenes que coincidan con el filtro.'
            : 'Todavía no creaste ninguna orden de compra.'}
        </EstadoVacio>
      )}

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Ítems</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Comprobante</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.datos.map((orden) => (
                <tr key={orden.id}>
                  <td data-etiqueta="Número">
                    <strong>{orden.numero}</strong>
                  </td>
                  <td data-etiqueta="Proveedor">{orden.proveedorNombre ?? '—'}</td>
                  <td data-etiqueta="Fecha">{formatearFecha(orden.fecha)}</td>
                  <td data-etiqueta="Ítems">{orden.renglones.length}</td>
                  <td data-etiqueta="Total">{moneda(orden.total)}</td>
                  <td data-etiqueta="Estado">
                    <span className={CLASE_ESTADO[orden.estado]}>
                      {ETIQUETA_ESTADO_ORDEN[orden.estado]}
                    </span>
                  </td>
                  <td data-etiqueta="Comprobante">{comprobanteDe(orden)}</td>
                  <td className="celda-acciones">
                    <div className="fila-acciones">
                      <button className="btn btn-sm" onClick={() => setOrdenAbierta(orden)}>
                        Ver
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => descargarPdfOrdenCompra(orden)}
                        title="Descargar la orden en PDF para imprimir o enviar"
                      >
                        🖨 PDF
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
          <button className="btn btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="texto-suave">
            Página {pagina} de {totalPaginas} · {data.total} órdenes
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

      <ModalNuevaOrden
        abierto={modalAlta}
        onCerrar={() => setModalAlta(false)}
        onEnviar={alEnviar}
      />
      {ordenAEnviar && (
        <EnviarOrden orden={ordenAEnviar} onCerrar={() => setOrdenAEnviar(null)} />
      )}
      {ordenAbierta && (
        <ModalDetalleOrden
          orden={ordenAbierta}
          onCerrar={() => setOrdenAbierta(null)}
          onEnviar={alEnviar}
        />
      )}
    </>
  );
}

// ─────────────────────── Nueva orden ───────────────────────

interface RenglonBorrador extends Omit<RenglonInput, 'cantidad'> {
  /** Se guarda para mostrar el nombre sin volver a pedirlo a la API. */
  materialNombre: string;
  unidad: string;
  /**
   * Vacía mientras no se cargó. Los renglones escaneados con la pistola nacen
   * así: se escanean los diez de corrido y las cantidades se ponen después,
   * sentado, en la tabla. La orden no se puede crear hasta que estén todas.
   */
  cantidad: number | undefined;
}

function ModalNuevaOrden({
  abierto,
  onCerrar,
  onEnviar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Se llama tras imprimir, para ofrecer el envío al proveedor. */
  onEnviar?: (orden: OrdenCompra) => void;
}) {
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [renglones, setRenglones] = useState<RenglonBorrador[]>([]);

  // Renglón que se está armando.
  const [material, setMaterial] = useState<Material | null>(null);
  // Alta de un material que no existe todavia, sin salir de la orden.
  const [nombreACrear, setNombreACrear] = useState<string | null>(null);
  // Id del recien creado: remonta el combo para que quede seleccionado.
  const [materialNuevo, setMaterialNuevo] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState<number | undefined>(undefined);
  const [precio, setPrecio] = useState<number | undefined>(undefined);
  /** Lo último que pasó al agregar, para que se vea que el escaneo entró. */
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  const traerMaterial = useTraerMaterial();
  const crear = useCrearOrden();
  const emitir = useEmitirOrdenPorId();

  const limpiar = () => {
    setProveedorId('');
    setObservaciones('');
    setRenglones([]);
    setMaterial(null);
    // Si no se limpia, el combo remontado volveria a preseleccionar el material
    // recien creado en el renglon siguiente.
    setMaterialNuevo(null);
    setCantidad(undefined);
    setPrecio(undefined);
    setAviso(null);
  };

  /**
   * Mete el material en la orden. La cantidad puede venir vacía: escaneando no
   * hay ninguna, y se completa después en la tabla.
   *
   * Devuelve si entró, para que quien escanea sepa si hay que remontar el
   * buscador.
   */
  const sumarMaterial = (m: Material, c?: number, p?: number): boolean => {
    // El backend rechaza el mismo material dos veces: lo avisamos antes.
    if (renglones.some((r) => r.materialId === m.id)) {
      // Nada de `alert` acá. Es modal: se come el escaneo siguiente y corta la
      // ráfaga, y un doble disparo de la pistola sobre la misma etiqueta es lo
      // más común que va a pasar.
      setAviso({ texto: `«${m.nombre}» ya estaba en la orden.`, error: true });
      return false;
    }
    setAviso({ texto: `Agregado: ${m.nombre}`, error: false });
    setRenglones((rs) => [
      ...rs,
      {
        materialId: m.id,
        materialNombre: m.nombre,
        unidad: m.unidad,
        cantidad: c,
        precioUnitario: p,
      },
    ]);
    return true;
  };

  /** Trae el material escaneado y lo suma, venga del campo o del aire. */
  const usarEscaneo = async (id: string) => {
    try {
      sumarMaterial(await traerMaterial(id));
    } catch {
      setAviso({ texto: 'Ese código no es de ningún material del sistema.', error: true });
    }
  };

  // Un escaneo cae donde esté el cursor. Si quedó en un botón —el «Quitar» de
  // un renglón— o en ningún lado, este enganche lo levanta igual en vez de
  // perderlo, y de paso frena el Enter para que no apriete ese botón.
  useEscaneoSuelto(abierto, (escaneo) => {
    if (escaneo.clase === 'equipo') {
      setAviso({ texto: 'Ese QR es de un equipo, no de un material.', error: true });
      return;
    }
    void usarEscaneo(escaneo.id);
  });

  const agregarRenglon = () => {
    if (!material) return;
    if (!sumarMaterial(material, cantidad, precio)) return;
    setMaterial(null);
    // Si no se limpia, el combo remontado volveria a preseleccionar el material
    // recien creado en el renglon siguiente.
    setMaterialNuevo(null);
    setCantidad(undefined);
    setPrecio(undefined);
  };

  const quitarRenglon = (materialId: string) =>
    setRenglones((rs) => rs.filter((r) => r.materialId !== materialId));

  /** La cantidad y el precio se editan en la tabla, que es donde se completan. */
  const cambiarRenglon = (materialId: string, cambio: Partial<RenglonBorrador>) =>
    setRenglones((rs) => rs.map((r) => (r.materialId === materialId ? { ...r, ...cambio } : r)));

  /** Los que entraron escaneados y todavía esperan que alguien ponga cuánto. */
  const sinCantidad = renglones.filter((r) => r.cantidad === undefined || r.cantidad <= 0);

  const total =
    renglones.length > 0 &&
    renglones.every((r) => r.cantidad !== undefined && r.precioUnitario !== undefined)
      ? renglones.reduce((s, r) => s + (r.cantidad ?? 0) * (r.precioUnitario ?? 0), 0)
      : null;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    // El botón ya está deshabilitado, pero un Enter suelto no pasa por el botón.
    if (sinCantidad.length > 0) return;
    const orden = await crear.mutateAsync({
      proveedorId,
      observaciones: observaciones || undefined,
      // `flatMap` y no `map`: los renglones sin cantidad no son una orden de
      // compra válida, y acá ya sabemos que no queda ninguno.
      renglones: renglones.flatMap(({ materialId, cantidad: c, precioUnitario }) =>
        c === undefined ? [] : [{ materialId, cantidad: c, precioUnitario }],
      ),
    });
    limpiar();
    onCerrar();

    // Imprimir la orden es, en la practica, mandarsela al proveedor: si el
    // usuario baja el PDF, la orden pasa directo a "pendiente de recibo" y no
    // hay que acordarse de emitirla despues en otra pantalla.
    const imprimir = confirm(
      [
        `Orden ${orden.numero} creada.`,
        '',
        '¿Imprimir y enviar al proveedor?',
        'Se descarga el PDF y la orden queda pendiente de recibo.',
      ].join('\n'),
    );
    if (!imprimir) return;

    await descargarPdfOrdenCompra(orden);
    await emitir.mutateAsync(orden.id);
    // El PDF ya está bajado: ahora se ofrece a quién mandárselo. Si no hay
    // onEnviar (operario), termina acá, como antes del envío automático.
    onEnviar?.(orden);
  };

  return (
    <Modal titulo="Nueva orden de compra" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          Proveedor *
          <ComboProveedor onCambio={(p) => setProveedorId(p?.id ?? '')} />
        </label>

        <h3 className="subtitulo-form">Materiales a comprar</h3>

        <div className="panel alta-renglon">
          <label className="alta-renglon-material">
            Material
            {/* La `key` fuerza a remontar el combo tras cada alta: mantiene
                estado interno y si no, seguiría mostrando el material anterior.
                Solo ofrece materiales cargados en el sistema (busca en la API). */}
            <ComboMaterial
              key={`material-${renglones.length}-${materialNuevo ?? ''}`}
              materialId={materialNuevo ?? ''}
              onCambio={setMaterial}
              onCrear={setNombreACrear}
              // Escanear agrega el renglón directamente, sin cantidad. Es lo que
              // permite pasar diez etiquetas de corrido sin soltar la pistola.
              onEscaneo={(m) => sumarMaterial(m)}
              // Al agregar un renglón el combo se remonta (cambia la `key`), así
              // que sin esto el cursor se perdería y el escaneo siguiente caería
              // en cualquier lado. Al abrir la orden no se lo roba al proveedor.
              enfocarAlMontar={renglones.length > 0}
            />
          </label>
          <label>
            Cantidad *
            <CampoNumero
              step="0.001"
              min="0.001"
              placeholder="0"
              valor={cantidad}
              onCambio={setCantidad}
            />
          </label>
          <label>
            Precio unitario
            <CampoNumero
              step="0.01"
              min="0"
              placeholder="opcional"
              valor={precio}
              onCambio={setPrecio}
            />
          </label>
          <button
            type="button"
            className="btn btn-primario alta-renglon-boton"
            onClick={agregarRenglon}
            disabled={!material}
          >
            + Agregar
          </button>
        </div>

        {aviso && (
          <p className={aviso.error ? 'aviso-escaneo es-error' : 'aviso-escaneo'} role="status">
            {aviso.texto}
          </p>
        )}

        {renglones.length === 0 && (
          <p className="texto-suave">
            Escaneá el QR del material con la pistola y entra solo, uno atrás del otro. O
            buscálo por nombre y tocá «Agregar». Las cantidades se cargan después, en la
            tabla. La orden necesita al menos un material.
          </p>
        )}

        {renglones.length > 0 && (
          <div className="tabla-scroll tabla-cards-contenedor">
            <table className="tabla tabla-cards">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Cantidad</th>
                  <th>P. unitario</th>
                  <th>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {renglones.map((r) => (
                  <tr key={r.materialId}>
                    <td data-etiqueta="Material">{r.materialNombre}</td>
                    <td
                      data-etiqueta="Cantidad"
                      className={
                        r.cantidad === undefined
                          ? 'celda-editable renglon-sin-cantidad'
                          : 'celda-editable'
                      }
                    >
                      <CampoNumero
                        step="0.001"
                        min="0.001"
                        placeholder="0"
                        valor={r.cantidad}
                        aria-label={`Cantidad de ${r.materialNombre}`}
                        onCambio={(c) => cambiarRenglon(r.materialId, { cantidad: c })}
                      />
                      <span className="texto-suave">{r.unidad}</span>
                    </td>
                    <td data-etiqueta="P. unitario" className="celda-editable">
                      {/* Tambien editable: escaneando, el renglón nace sin precio
                          y antes no habia forma de ponerselo sin rehacerlo. */}
                      <CampoNumero
                        step="0.01"
                        min="0"
                        placeholder="opcional"
                        valor={r.precioUnitario}
                        aria-label={`Precio unitario de ${r.materialNombre}`}
                        onCambio={(p) => cambiarRenglon(r.materialId, { precioUnitario: p })}
                      />
                    </td>
                    <td data-etiqueta="Subtotal">
                      {r.cantidad !== undefined && r.precioUnitario !== undefined
                        ? moneda(r.cantidad * r.precioUnitario)
                        : '—'}
                    </td>
                    <td className="celda-acciones">
                      <button
                        type="button"
                        className="btn btn-sm btn-peligro"
                        onClick={() => quitarRenglon(r.materialId)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {total !== null && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>Total</strong>
                    </td>
                    <td colSpan={2}>
                      <strong>{moneda(total)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <label className="campo">
          Observaciones
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Salen impresas en la orden"
          />
        </label>

        {sinCantidad.length > 0 && (
          <p className="aviso-escaneo es-error">
            {sinCantidad.length === 1
              ? `Falta la cantidad de «${sinCantidad[0].materialNombre}».`
              : `Faltan las cantidades de ${sinCantidad.length} materiales.`}
          </p>
        )}

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={
              crear.isPending || !proveedorId || renglones.length === 0 || sinCantidad.length > 0
            }
          >
            {crear.isPending ? 'Creando…' : 'Crear orden'}
          </button>
        </div>
      </form>

      {nombreACrear !== null && (
        <NuevoMaterialRapido
          nombreInicial={nombreACrear}
          onCerrar={() => setNombreACrear(null)}
          onCreado={(nuevo) => {
            // Queda elegido en el combo: quien lo creó ya lo queria usar.
            setMaterial(nuevo);
            setMaterialNuevo(nuevo.id);
            setNombreACrear(null);
          }}
        />
      )}
    </Modal>
  );
}

// ─────────────────────── Detalle de la orden ───────────────────────

function ModalDetalleOrden({
  orden,
  onCerrar,
  onEnviar,
}: {
  orden: OrdenCompra;
  onCerrar: () => void;
  onEnviar?: (orden: OrdenCompra) => void;
}) {
  const emitir = useEmitirOrden(orden.id);
  const recibir = useRecibirOrden(orden.id);
  const anular = useAnularOrden(orden.id);
  const eliminar = useEliminarOrden();

  const [remito, setRemito] = useState('');
  const [factura, setFactura] = useState('');
  // Sin comprobante no se cierra la orden: es lo unico que ata la entrada de
  // stock al papel. El servidor lo rechaza igual; esto evita el viaje.
  const hayComprobante = remito.trim() !== '' || factura.trim() !== '';
  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);

  const errorAccion = emitir.error ?? recibir.error ?? anular.error ?? eliminar.error;

  return (
    <Modal titulo={`Orden ${orden.numero}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <div className="dato">
            <span className="texto-suave texto-chico">Proveedor</span>
            <span>{orden.proveedorNombre ?? '—'}</span>
          </div>
          {orden.proveedorCuit && (
            <div className="dato">
              <span className="texto-suave texto-chico">CUIT</span>
              <span>{orden.proveedorCuit}</span>
            </div>
          )}
          <div className="dato">
            <span className="texto-suave texto-chico">Estado</span>
            <span className={CLASE_ESTADO[orden.estado]}>
              {ETIQUETA_ESTADO_ORDEN[orden.estado]}
            </span>
          </div>
          <div className="dato">
            <span className="texto-suave texto-chico">Fecha</span>
            <span>{formatearFecha(orden.fecha)}</span>
          </div>
          {orden.creadoPorNombre && (
            <div className="dato">
              <span className="texto-suave texto-chico">Solicitó</span>
              <span>{orden.creadoPorNombre}</span>
            </div>
          )}
          {orden.recibidaEn && (
            <div className="dato">
              <span className="texto-suave texto-chico">Recibida</span>
              <span>
                {formatearFecha(orden.recibidaEn)}
                {orden.recibidaPorNombre ? ` · ${orden.recibidaPorNombre}` : ''}
              </span>
            </div>
          )}
          {/* El comprobante con el que llegó la mercadería. Es el dato que se
              compara contra el papel, así que va en la ficha y no escondido en
              el formulario de recibir, que después de recibir ya no se abre. */}
          {orden.remito && (
            <div className="dato">
              <span className="texto-suave texto-chico">Remito</span>
              <span>
                <strong>{orden.remito}</strong>
              </span>
            </div>
          )}
          {orden.factura && (
            <div className="dato">
              <span className="texto-suave texto-chico">Factura</span>
              <span>
                <strong>{orden.factura}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Material</th>
                <th>Cantidad</th>
                <th>P. unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {orden.renglones.map((r) => (
                <tr key={r.id}>
                  <td data-etiqueta="Material">{r.materialNombre ?? '—'}</td>
                  <td data-etiqueta="Cantidad">
                    {formatearNumero(r.cantidad)} {r.unidad ?? ''}
                  </td>
                  <td data-etiqueta="P. unitario">{moneda(r.precioUnitario)}</td>
                  <td data-etiqueta="Subtotal">{moneda(r.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            {orden.total !== null && (
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{moneda(orden.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {orden.observaciones && (
          <>
            <h3 className="subtitulo-form">Observaciones</h3>
            <p className="texto-suave">{orden.observaciones}</p>
          </>
        )}

        {orden.estado === 'RECIBIDA' && (
          <div className="alerta alerta-exito">
            ✔ Orden finalizada: la mercadería ya ingresó al stock. Cada renglón generó su
            movimiento de ENTRADA, que podés ver en el Historial.
          </div>
        )}

        {/* El papel del remito o la factura. Se muestra desde que la orden se
            emitió: a veces el comprobante llega con la mercadería y se carga
            antes de terminar de contar todo. */}
        {orden.estado !== 'BORRADOR' && <ComprobantesOrden ordenId={orden.id} />}

        {mostrarRecepcion && (
          <div className="panel">
            <div className="grilla-2">
              <label className="campo">
                Nº de remito
                <input
                  value={remito}
                  onChange={(e) => setRemito(e.target.value)}
                  placeholder="R-0001-00012345"
                />
              </label>
              <label className="campo">
                Nº de factura
                <input
                  value={factura}
                  onChange={(e) => setFactura(e.target.value)}
                  placeholder="A-0001-00098765"
                />
              </label>
            </div>
            <p className="texto-suave texto-chico">
              Hace falta <strong>uno de los dos</strong>. Es lo que después permite cruzar el
              stock con el papel que quedó en la empresa.
            </p>
            <p className="texto-suave texto-chico">
              Al confirmar, la orden queda <strong>finalizada</strong> y cada material de la
              orden suma su cantidad al stock.
            </p>
            <div className="acciones">
              <button className="btn" onClick={() => setMostrarRecepcion(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                disabled={recibir.isPending || !hayComprobante}
                title={hayComprobante ? undefined : 'Cargá el número de remito o el de factura'}
                onClick={async () => {
                  await recibir.mutateAsync({
                    remito: remito.trim() || undefined,
                    factura: factura.trim() || undefined,
                  });
                  setMostrarRecepcion(false);
                  onCerrar();
                }}
              >
                {recibir.isPending ? 'Registrando…' : 'Confirmar y sumar al stock'}
              </button>
            </div>
          </div>
        )}

        {errorAccion && <MensajeError error={errorAccion} />}

        <div className="acciones">
          <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
            🖨 Descargar PDF
          </button>
          {onEnviar && orden.estado !== 'BORRADOR' && (
            <button className="btn" onClick={() => onEnviar(orden)}>
              ✉ Enviar al proveedor
            </button>
          )}

          {orden.estado === 'BORRADOR' && (
            <button
              className="btn btn-primario"
              disabled={emitir.isPending}
              onClick={async () => {
                // Imprimir y marcar como enviada es un solo gesto: se baja el
                // PDF para mandarle al proveedor y la orden queda esperando la
                // mercaderia.
                await descargarPdfOrdenCompra(orden);
                await emitir.mutateAsync();
                onEnviar?.(orden);
                onCerrar();
              }}
            >
              {emitir.isPending ? 'Procesando…' : '🖨 Imprimir y enviar al proveedor'}
            </button>
          )}

          {orden.estado === 'EMITIDA' && !mostrarRecepcion && (
            <button className="btn btn-primario" onClick={() => setMostrarRecepcion(true)}>
              ✔ Marcar como recibida
            </button>
          )}

          {(orden.estado === 'BORRADOR' || orden.estado === 'EMITIDA') && (
            <button
              className="btn btn-peligro"
              disabled={anular.isPending}
              onClick={async () => {
                if (!confirm(`¿Anular la orden ${orden.numero}?`)) return;
                await anular.mutateAsync();
                onCerrar();
              }}
            >
              Anular
            </button>
          )}

          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
