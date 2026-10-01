import { useState } from 'react';
import { useEditarOrdenTrabajo } from '@/api/ordenesTrabajo';
import { apiRequest } from '@/lib/apiClient';
import { descargarPdfOrdenTrabajo } from '@/lib/pdfOrdenTrabajo';
import type { Equipo } from '@/tipos/equipo';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import type { Proveedor } from '@/tipos/proveedor';
import { ComboProveedor } from './ComboProveedor';
import { MensajeError } from './Estados';

/**
 * A qué taller se manda el trabajo, con la orden todavía abierta.
 *
 * El motor sale con la orden impresa, y el papel tiene que decir a dónde va:
 * por eso el proveedor se elige acá y no recién al cerrar. Al cerrar ya viene
 * cargado.
 */
export function MandarATaller({ orden }: { orden: OrdenTrabajo }) {
  const editar = useEditarOrdenTrabajo();
  const [eligiendo, setEligiendo] = useState(false);

  const mandar = (p: Proveedor | null) => {
    if (!p) return;
    editar.mutate(
      { id: orden.id, ejecutor: 'EXTERNO', proveedorId: p.id },
      { onSuccess: () => setEligiendo(false) },
    );
  };

  const traerAFabrica = () =>
    editar.mutate({ id: orden.id, ejecutor: 'INTERNO', proveedorId: null });

  return (
    <div className="campo">
      {orden.ejecutor === 'EXTERNO' && !eligiendo ? (
        <div className="fila-acciones">
          <span>
            <span className="texto-suave">Se manda a: </span>
            <strong>{orden.proveedorNombre}</strong>
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setEligiendo(true)}>
            Cambiar
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={editar.isPending}
            onClick={traerAFabrica}
          >
            Se hace en fábrica
          </button>
        </div>
      ) : eligiendo ? (
        <label className="campo">
          ¿A qué taller o proveedor se manda?
          <ComboProveedor onCambio={mandar} />
          <span className="texto-suave texto-chico">
            Después imprimí la orden para que viaje con el equipo.
          </span>
        </label>
      ) : (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setEligiendo(true)}>
            🚚 Mandar a un servicio externo
          </button>
        </div>
      )}
      {editar.isPending && <span className="texto-suave texto-chico">Guardando…</span>}
      {editar.error && <MensajeError error={editar.error} />}
    </div>
  );
}

/** Pide algo que el papel suma pero sin lo cual igual se puede imprimir. */
async function siSePuede<T>(pedido: Promise<T>): Promise<T | null> {
  try {
    return await pedido;
  } catch {
    return null;
  }
}

/**
 * Imprime la orden con el mismo membrete que la orden de compra.
 *
 * Trae la ficha del equipo y los datos del taller en el momento: la orden
 * solo tiene los nombres, y logística necesita marca, modelo, serie y a quién
 * llamar. Si alguno no se puede traer (por ejemplo, alguien sin permiso para
 * ver proveedores), el papel sale igual con lo que hay.
 */
export function ImprimirOrdenTrabajo({ orden }: { orden: OrdenTrabajo }) {
  const [imprimiendo, setImprimiendo] = useState(false);

  const imprimir = async () => {
    setImprimiendo(true);
    try {
      const [equipo, proveedor] = await Promise.all([
        orden.equipoId ? siSePuede(apiRequest<Equipo>(`/equipos/${orden.equipoId}`)) : null,
        orden.proveedorId
          ? siSePuede(apiRequest<Proveedor>(`/proveedores/${orden.proveedorId}`))
          : null,
      ]);
      await descargarPdfOrdenTrabajo(orden, { equipo, proveedor });
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <button type="button" className="btn btn-sm" disabled={imprimiendo} onClick={imprimir}>
      {imprimiendo ? 'Armando el PDF…' : '🖨 Imprimir orden'}
    </button>
  );
}
