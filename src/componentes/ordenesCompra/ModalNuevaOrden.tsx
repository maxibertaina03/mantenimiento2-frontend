import { useState } from 'react';
import { useCrearOrden, useEmitirOrdenPorId } from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { NuevoMaterialRapido } from '@/componentes/NuevoMaterialRapido';
import { ComboProveedor } from '@/componentes/ComboProveedor';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { useTraerMaterial } from '@/api/materiales';
import { useEscaneoSuelto } from '@/lib/escaneo';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { CLASIFICACIONES_EQUIPO, ETIQUETA_CLASIFICACION } from '@/tipos/ordenCompra';
import type { ClasificacionEquipo, OrdenCompra } from '@/tipos/ordenCompra';
import type { Material } from '@/tipos/material';
import { renglonesParaEnviar, type RenglonBorrador } from '@/lib/renglonesOrden';
import { moneda } from './formato';

export function ModalNuevaOrden({
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

  // El alta de un equipo o herramienta, que va por un camino aparte del pañol.
  const [equipoTexto, setEquipoTexto] = useState('');
  const [equipoClase, setEquipoClase] = useState<ClasificacionEquipo>('HERRAMIENTA');
  const [equipoCantidad, setEquipoCantidad] = useState<number | undefined>(undefined);
  const [equipoPrecio, setEquipoPrecio] = useState<number | undefined>(undefined);

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
        clave: `mat-${m.id}`,
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

  /**
   * Suma un renglón de equipo o herramienta.
   *
   * No lleva stock: al cerrar la compra, cada unidad queda como una ficha
   * aparte en el módulo de equipos, para completarle serie y demás. Por eso
   * las unidades tienen que ser enteras —media amoladora no existe— y por eso
   * no se busca en el pañol: todavía no existe.
   */
  const agregarEquipo = () => {
    const descripcion = equipoTexto.trim();
    if (descripcion === '') return;

    setRenglones((rs) => [
      ...rs,
      {
        // Una clave por renglón y no por descripción: comprar dos veces la
        // misma herramienta en la misma orden es válido (dos sectores, dos
        // precios), al revés que con los materiales.
        clave: `eq-${Date.now()}-${rs.length}`,
        descripcionEquipo: descripcion,
        clasificacion: equipoClase,
        materialNombre: descripcion,
        unidad: equipoClase === 'HERRAMIENTA' ? 'herramienta' : 'equipo',
        cantidad: equipoCantidad,
        precioUnitario: equipoPrecio,
      },
    ]);
    setAviso({ texto: `Agregado: ${descripcion}`, error: false });
    setEquipoTexto('');
    setEquipoCantidad(undefined);
    setEquipoPrecio(undefined);
  };

  const quitarRenglon = (clave: string) =>
    setRenglones((rs) => rs.filter((r) => r.clave !== clave));

  /** La cantidad y el precio se editan en la tabla, que es donde se completan. */
  const cambiarRenglon = (clave: string, cambio: Partial<RenglonBorrador>) =>
    setRenglones((rs) => rs.map((r) => (r.clave === clave ? { ...r, ...cambio } : r)));

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
      renglones: renglonesParaEnviar(renglones),
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

        <h3 className="subtitulo-form">Materiales del pañol</h3>

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

        <h3 className="subtitulo-form">Equipos y herramientas</h3>
        <p className="texto-suave texto-chico">
          No llevan stock. Al cerrar la compra, cada unidad queda como una ficha aparte en
          Equipos, para completarle el número de serie y el resto. Las herramientas chicas y
          de consumo —brocas, llaves— van arriba, como material.
        </p>

        <div className="panel alta-renglon alta-renglon-equipo">
          <label className="alta-renglon-material">
            Qué se compra
            <input
              type="text"
              value={equipoTexto}
              maxLength={200}
              placeholder="Amoladora angular 4 1/2"
              onChange={(e) => setEquipoTexto(e.target.value)}
            />
          </label>
          <label>
            Qué es
            <select
              value={equipoClase}
              onChange={(e) => setEquipoClase(e.target.value as ClasificacionEquipo)}
            >
              {CLASIFICACIONES_EQUIPO.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CLASIFICACION[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unidades
            {/* Enteras: cada una va a ser una ficha, y media amoladora no existe. */}
            <CampoNumero
              step="1"
              min="1"
              placeholder="1"
              valor={equipoCantidad}
              onCambio={setEquipoCantidad}
            />
          </label>
          <label>
            P. unitario
            <CampoNumero
              step="0.01"
              min="0"
              placeholder="opcional"
              valor={equipoPrecio}
              onCambio={setEquipoPrecio}
            />
          </label>
          <button
            type="button"
            className="btn btn-primario alta-renglon-boton"
            onClick={agregarEquipo}
            disabled={equipoTexto.trim() === ''}
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
                        onCambio={(c) => cambiarRenglon(r.clave, { cantidad: c })}
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
                        onCambio={(p) => cambiarRenglon(r.clave, { precioUnitario: p })}
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
                        onClick={() => quitarRenglon(r.clave)}
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
