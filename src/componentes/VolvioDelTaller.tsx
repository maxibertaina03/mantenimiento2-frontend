import { useState } from 'react';
import { useCerrarOrdenTrabajo } from '@/api/ordenesTrabajo';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import { CampoNumero } from './CampoNumero';
import { MensajeError } from './Estados';
import { Modal } from './Modal';

/**
 * El equipo volvió del taller de afuera: se cierra la orden con lo que hizo
 * el taller, su remito o factura y lo que cobró.
 *
 * Al cerrarla, el equipo deja de figurar «En reparación» y el trabajo queda en
 * su historial, con el papel del taller para cruzarlo después.
 */
export function VolvioDelTaller({
  orden,
  onCerrar,
}: {
  orden: OrdenTrabajo;
  onCerrar: () => void;
}) {
  const cerrar = useCerrarOrdenTrabajo();
  const [resolucion, setResolucion] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [costo, setCosto] = useState<number | undefined>(undefined);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await cerrar.mutateAsync({
        id: orden.id,
        resolucion: resolucion.trim(),
        comprobanteExterno: comprobante.trim() || undefined,
        costoManoObra: costo,
      });
      onCerrar();
    } catch {
      // El rechazo se muestra abajo, desde `cerrar.error`.
    }
  };

  return (
    <Modal titulo={`Volvió del taller · ${orden.numero}`} abierto onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={confirmar}>
        <p>
          <strong>{orden.equipoNombre ?? orden.equipoItNombre ?? 'El equipo'}</strong> vuelve de{' '}
          <strong>{orden.proveedorNombre ?? 'el taller'}</strong>: {orden.titulo}.
        </p>

        <label className="campo">
          ¿Qué le hizo el taller? *
          <textarea
            rows={3}
            value={resolucion}
            maxLength={2000}
            required
            placeholder="Ej: lo llenaron y probaron la válvula; bobinado nuevo y rodamientos"
            onChange={(e) => setResolucion(e.target.value)}
          />
        </label>

        <div className="grilla-2">
          <label className="campo">
            Remito o factura del taller
            <input
              value={comprobante}
              maxLength={100}
              placeholder="R-0001-00004930"
              onChange={(e) => setComprobante(e.target.value)}
            />
          </label>
          <label className="campo">
            Lo que cobró
            <CampoNumero
              step="0.01"
              min="0"
              placeholder="opcional"
              valor={costo}
              onCambio={setCosto}
            />
          </label>
        </div>

        <p className="texto-suave texto-chico">
          La orden se cierra y queda en el historial del equipo. Si el equipo figuraba «En
          reparación» por este trabajo, vuelve a «Operativo».
        </p>

        {cerrar.error && <MensajeError error={cerrar.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={cerrar.isPending || resolucion.trim() === ''}
          >
            {cerrar.isPending ? 'Cerrando…' : '✔ Volvió: cerrar la orden'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
