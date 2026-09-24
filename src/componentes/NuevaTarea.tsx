import { useState } from 'react';
import { useCrearTarea } from '@/api/calendario';
import { useAsignables } from '@/api/ordenesTrabajo';
import { ComboEquipo } from './ComboEquipo';
import { ComboEquipoIt } from './ComboEquipoIt';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import { P, usePuede } from '@/lib/permisos';

/**
 * Programar una tarea para un día.
 *
 * El equipo es opcional y solo lo ofrece quien puede ver equipos, igual que en
 * las órdenes de trabajo: si no, se elegiría cualquiera con tal de guardar.
 *
 * Son dos campos, planta e informática, y elegir en uno limpia el otro: una
 * tarea es sobre una máquina o sobre una PC, nunca sobre las dos. El backend lo
 * rechaza igual; acá se evita que alguien llegue a intentarlo.
 */
export function NuevaTarea({ fecha, onCerrar }: { fecha: string; onCerrar: () => void }) {
  const puede = usePuede();
  const crear = useCrearTarea();
  const { data: asignables } = useAsignables();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cuando, setCuando] = useState(fecha);
  const [asignadoA, setAsignadoA] = useState('');
  const [equipo, setEquipo] = useState<{ id: string; nombre: string } | null>(null);
  const [equipoIt, setEquipoIt] = useState<{ id: string; nombre: string } | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      titulo,
      descripcion: descripcion || undefined,
      fecha: cuando,
      asignadoAId: asignadoA || undefined,
      equipoId: equipo?.id ?? undefined,
      equipoItId: equipoIt?.id ?? undefined,
    });
    onCerrar();
  };

  return (
    <Modal titulo="Nueva tarea" abierto onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          ¿Qué hay que hacer? *
          <input
            type="text"
            value={titulo}
            maxLength={200}
            required
            placeholder="Revisar presion de caldera"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <div className="grilla-filtros">
          <label className="campo">
            Cuándo
            <input
              type="date"
              value={cuando}
              required
              onChange={(e) => setCuando(e.target.value)}
            />
          </label>

          <label className="campo">
            Quién la hace
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}>
              <option value="">Sin repartir</option>
              {(asignables ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        {puede(P.EQUIPOS_VER) && (
          <label className="campo">
            Máquina de planta (opcional)
            <ComboEquipo
              key={`planta-${equipoIt?.id ?? 'no'}`}
              onCambio={(e) => {
                setEquipo(e);
                if (e) setEquipoIt(null);
              }}
            />
          </label>
        )}

        {puede(P.IT_VER) && (
          <label className="campo">
            Equipo de informática (opcional)
            <ComboEquipoIt
              key={`it-${equipo?.id ?? 'no'}`}
              onCambio={(e) => {
                setEquipoIt(e);
                if (e) setEquipo(null);
              }}
            />
          </label>
        )}

        <label className="campo">
          Detalle (opcional)
          <textarea
            rows={3}
            value={descripcion}
            maxLength={2000}
            placeholder="Qué mirar, con qué, a qué prestarle atención"
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
            {crear.isPending ? 'Programando…' : 'Programar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
