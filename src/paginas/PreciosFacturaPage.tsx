import { useNavigate, useParams } from 'react-router-dom';
import { useOrden } from '@/api/ordenesCompra';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { PreciosDesdeFactura } from '@/componentes/ordenesCompra/PreciosDesdeFactura';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/** Lo que la lista de órdenes recibe al volver: qué orden reabrir. */
export interface VueltaDeFactura {
  abrirOrden: OrdenCompra;
  preciosGuardados?: boolean;
}

/**
 * Precios desde la factura, en una página entera: la factura y los renglones
 * lado a lado, a pantalla completa. Al terminar (o al volver) se reabre el
 * detalle de la orden en la lista.
 */
export function PreciosFacturaPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: orden, isLoading, error } = useOrden(id);

  const volver = (estado: VueltaDeFactura) =>
    navigate('/ordenes-compra', { state: estado satisfies VueltaDeFactura });

  if (isLoading) return <Cargando />;
  if (error || !orden) return <MensajeError error={error ?? new Error('No se encontró la orden.')} />;
  return (
    <PreciosDesdeFactura
      orden={orden}
      onListo={(actualizada) => volver({ abrirOrden: actualizada, preciosGuardados: true })}
      onCerrar={() => volver({ abrirOrden: orden })}
    />
  );
}
