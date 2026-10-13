import { useState } from 'react';
import { useRecibirOrden } from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { MensajeError } from '@/componentes/Estados';
import { formatearNumero } from '@/lib/formato';
import { nombreDelRenglon } from '@/tipos/ordenCompra';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * Recibir la mercadería de una orden: toda, o lo que llegó.
 *
 * Cada renglón arranca en 0: se carga, mirando el remito, lo que vino de cada
 * uno. Precargar lo pedido hacía fácil confirmar de más sin mirar. Si un
 * proveedor entregó una parte —llegaron los artefactos y no los acrílicos—
 * lo que no se carga queda pendiente:
 * la orden pasa a «Recibida en parte» y se puede volver a recibir con el
 * remito de la próxima entrega.
 */
export function RecibirMercaderia({
  orden,
  onListo,
  onCancelar,
}: {
  orden: OrdenCompra;
  onListo: (actualizada: OrdenCompra) => void;
  onCancelar: () => void;
}) {
  const recibir = useRecibirOrden(orden.id);
  const pendientes = orden.renglones.filter((r) => r.pendiente > 0);
  // Vacío cuenta como 0: así se escribe la cantidad sin borrar un 0 antes.
  const [llega, setLlega] = useState<Record<string, number | undefined>>({});
  const [remito, setRemito] = useState('');
  const [factura, setFactura] = useState('');

  const cantidad = (id: string) => llega[id] ?? 0;
  const pasados = pendientes.filter((r) => cantidad(r.id) > r.pendiente);
  const algoLlega = pendientes.some((r) => cantidad(r.id) > 0);
  const quedaPendiente = pendientes.filter((r) => cantidad(r.id) < r.pendiente);
  // Sin comprobante no se registra la entrega: es lo único que ata la entrada
  // de stock al papel. El servidor lo rechaza igual; esto evita el viaje.
  const hayComprobante = remito.trim() !== '' || factura.trim() !== '';
  const puedeConfirmar = algoLlega && hayComprobante && pasados.length === 0;

  const confirmar = async () => {
    try {
      const actualizada = await recibir.mutateAsync({
        remito: remito.trim() || undefined,
        factura: factura.trim() || undefined,
        renglones: pendientes.map((r) => ({ renglonId: r.id, cantidad: cantidad(r.id) })),
      });
      onListo(actualizada);
    } catch {
      // El rechazo se muestra abajo, desde `recibir.error`.
    }
  };

  return (
    <div className="panel">
      <h3 className="subtitulo-form">¿Qué llegó?</h3>
      <p className="texto-suave texto-chico">
        Mirando el remito, cargá cuánto llegó de cada material. Lo que quede en 0 sigue pendiente
        para la próxima entrega.
      </p>

      <div className="tabla-scroll tabla-cards-contenedor">
        <table className="tabla tabla-cards recibir-tabla">
          <thead>
            <tr>
              <th>Material</th>
              <th>Pedido</th>
              <th>Ya recibido</th>
              <th>Llegó ahora</th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((r) => (
              <tr key={r.id}>
                <td data-etiqueta="Material">{nombreDelRenglon(r) ?? '—'}</td>
                <td data-etiqueta="Pedido">
                  {formatearNumero(r.cantidad)} {r.unidad ?? ''}
                </td>
                <td data-etiqueta="Ya recibido">{formatearNumero(r.cantidadRecibida)}</td>
                <td data-etiqueta="Llegó ahora" className="celda-llega">
                  <CampoNumero
                    min="0"
                    placeholder="0"
                    step={r.materialId ? '0.001' : '1'}
                    aria-label={`Cuánto llegó de ${nombreDelRenglon(r) ?? 'el renglón'}`}
                    valor={llega[r.id]}
                    onCambio={(v) => setLlega((x) => ({ ...x, [r.id]: v }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pasados.length > 0 && (
        <div className="alerta alerta-error">
          ⚠️ De «{nombreDelRenglon(pasados[0])}» faltan {formatearNumero(pasados[0].pendiente)}: no
          se puede recibir más de lo que se pidió.
        </div>
      )}

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
        Hace falta <strong>uno de los dos</strong>, el de esta entrega. Es lo que después permite
        cruzar el stock con el papel que quedó en la empresa.
      </p>

      <p className="texto-chico">
        {!algoLlega
          ? 'Indicá qué llegó: al menos un renglón con una cantidad mayor que cero.'
          : quedaPendiente.length === 0
            ? 'Llega todo: la orden queda finalizada y cada material suma al stock lo que llegó.'
            : `Lo que llegó suma al stock. Quedan pendientes ${quedaPendiente.length} ${
                quedaPendiente.length === 1 ? 'renglón' : 'renglones'
              }: la orden queda «Recibida en parte», y lo que falta se puede reclamar.`}
      </p>

      {recibir.error && <MensajeError error={recibir.error} />}

      <div className="acciones">
        <button type="button" className="btn" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primario"
          disabled={recibir.isPending || !puedeConfirmar}
          title={hayComprobante ? undefined : 'Cargá el número de remito o el de factura'}
          onClick={confirmar}
        >
          {recibir.isPending ? 'Registrando…' : 'Confirmar y sumar al stock'}
        </button>
      </div>
    </div>
  );
}
