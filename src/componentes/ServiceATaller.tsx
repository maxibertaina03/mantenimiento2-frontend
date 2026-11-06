import { Truck } from 'lucide-react';
import { useState } from 'react';
import { useAsignables, useCrearOrdenTrabajo } from '@/api/ordenesTrabajo';
import { useUsuarioActual } from '@/api/usuarios';
import { ComboProveedor } from '@/componentes/ComboProveedor';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import type { PlanQueVence } from '@/tipos/equipo';

/**
 * Mandar un service a un taller de afuera.
 *
 * Es una orden de trabajo preventiva, abierta, del plan y con el taller: la
 * máquina queda «En reparación» mientras está afuera y la tarea del service,
 * en proceso. Cuando vuelve se cierra la orden (con el remito o la factura
 * del taller) y el plan corre solo a la próxima fecha, igual que si se
 * hubiera hecho en la planta.
 */
export function ServiceATaller({
  plan,
  onListo,
  onCerrar,
}: {
  plan: PlanQueVence;
  /** La orden que se abrió, para imprimirla o mandarla al taller. */
  onListo: (ordenId: string) => void;
  onCerrar: () => void;
}) {
  const crear = useCrearOrdenTrabajo();
  const { data: asignables } = useAsignables();
  const { data: yo } = useUsuarioActual();
  const [taller, setTaller] = useState<{ id: string; nombre: string } | null>(null);
  // Quién la sigue: el que la manda, si puede tener órdenes.
  const [responsable, setResponsable] = useState('');
  const elegido =
    responsable || (asignables?.some((a) => a.id === yo?.id) ? (yo?.id ?? '') : '');

  const mandar = async () => {
    if (!taller || !elegido) return;
    const orden = await crear.mutateAsync({
      titulo: plan.nombre,
      descripcion: plan.tareas,
      tipo: 'PREVENTIVO',
      equipoId: plan.equipoId,
      planId: plan.id,
      ejecutor: 'EXTERNO',
      proveedorId: taller.id,
      asignadoAId: elegido,
    });
    onListo(orden.id);
  };

  return (
    <Modal titulo="Mandar el service a un taller" abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p>
          <strong>{plan.nombre}</strong> de <strong>{plan.equipoNombre}</strong>
        </p>
        <label className="campo">
          ¿A qué taller va?
          <ComboProveedor onCambio={(p) => setTaller(p ? { id: p.id, nombre: p.nombre } : null)} />
        </label>
        <label className="campo">
          Quién lo sigue
          <select value={elegido} onChange={(e) => setResponsable(e.target.value)}>
            <option value="">Elegí a quién</option>
            {(asignables ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <p className="texto-suave texto-chico">
          Se abre una orden de trabajo para el taller: la máquina queda «En reparación» mientras
          está afuera. Cuando vuelve, se cierra la orden y el service queda hecho; el plan corre
          solo a la próxima fecha.
        </p>
        {crear.error && <MensajeError error={crear.error} />}
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primario"
            disabled={!taller || !elegido || crear.isPending}
            onClick={() => void mandar()}
          >
            <Truck className="icono" aria-hidden />
            {crear.isPending ? 'Abriendo la orden…' : 'Mandar al taller'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
