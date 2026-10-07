import { useState } from 'react';
import { useAsignables, useCrearOrdenTrabajo } from '@/api/ordenesTrabajo';
import { ComboEquipo } from '@/componentes/ComboEquipo';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_TIPO_TRABAJO, TIPOS_TRABAJO } from '@/tipos/ordenTrabajo';
import type { TipoTrabajo } from '@/tipos/ordenTrabajo';

export function ModalNuevaOrden({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const puede = usePuede();
  const crear = useCrearOrdenTrabajo();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoTrabajo>('CORRECTIVO');
  const [descripcion, setDescripcion] = useState('');
  const [equipo, setEquipo] = useState<{ id: string; nombre: string } | null>(null);
  /** Vacío quiere decir "para mí": el backend lo resuelve así. */
  const [asignadoA, setAsignadoA] = useState('');
  const { data: asignables } = useAsignables(abierto);

  const limpiar = () => {
    setTitulo('');
    setTipo('CORRECTIVO');
    setDescripcion('');
    setEquipo(null);
    setAsignadoA('');
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      titulo,
      tipo,
      descripcion: descripcion || undefined,
      equipoId: equipo?.id ?? undefined,
      asignadoAId: asignadoA || undefined,
    });
    limpiar();
    onCerrar();
  };

  return (
    <Modal titulo="Nueva orden de trabajo" abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          ¿Qué pasó, o para qué es el trabajo? *
          <input
            type="text"
            value={titulo}
            maxLength={200}
            required
            placeholder="Perdida en la bomba de recibo"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <label className="campo">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTrabajo)}>
            {TIPOS_TRABAJO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_TRABAJO[t]}
              </option>
            ))}
          </select>
        </label>

        {/* Si no se elige a nadie queda para uno mismo, que es el caso de
            abrirse una orden propia. Elegir a otro es el caso del encargado
            que reparte el trabajo. */}
        <label className="campo">
          Asignar a
          <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}>
            <option value="">Para mí</option>
            {(asignables ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        {/* El equipo solo lo puede elegir quien ve equipos. Mantenimiento
            todavía no tiene ese módulo: carga la orden sin máquina, contándolo
            en el título, y después un administrador la relaciona. */}
        {puede(P.EQUIPOS_VER) && (
          <label className="campo">
            Equipo (opcional)
            <ComboEquipo onCambio={setEquipo} />
          </label>
        )}

        <label className="campo">
          Detalle (opcional)
          <textarea
            rows={3}
            value={descripcion}
            maxLength={2000}
            placeholder="Lo que se vio, desde cuándo, qué se probó"
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={crear.isPending || titulo.trim() === ''}
          >
            {crear.isPending ? 'Abriendo…' : 'Abrir orden'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────── Detalle ───────────────────────
