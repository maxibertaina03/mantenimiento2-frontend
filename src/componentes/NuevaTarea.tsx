import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { useCrearTarea } from '@/api/calendario';
import { useSugerirEquipos } from '@/api/equipos';
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
 *
 * La máquina se reconoce en lo que se escribe: «cambio de rodamiento de
 * desmigadora» queda atada a la Desmigadora sola, si no hay dudas; si el
 * texto nombra varias («la tina»), se ofrecen para tocar la que es. Elegirla
 * a mano, o sacarla, gana siempre.
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
  /** La eligió (o la sacó) la persona: lo que se escribe ya no la cambia. */
  const [equipoAMano, setEquipoAMano] = useState(false);
  /** La ató el sistema por lo que se escribió, para avisarlo. */
  const [porElTexto, setPorElTexto] = useState(false);
  /** Para que el combo muestre la máquina que se eligió desde afuera. */
  const [versionCombo, setVersionCombo] = useState(0);

  // El texto se lee recién cuando se deja de escribir.
  const [textoQuieto, setTextoQuieto] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTextoQuieto(`${titulo} ${descripcion}`), 450);
    return () => clearTimeout(t);
  }, [titulo, descripcion]);
  const veEquipos = puede(P.EQUIPOS_VER);
  const { data: sugeridos } = useSugerirEquipos(
    textoQuieto,
    veEquipos && !equipoAMano && !equipoIt,
  );

  const ponerEquipo = (e: { id: string; nombre: string } | null, delTexto: boolean) => {
    setEquipo(e);
    setPorElTexto(delTexto && e !== null);
    if (e) setEquipoIt(null);
    setVersionCombo((v) => v + 1);
  };

  // Si el texto nombra una sola máquina sin dudas, queda atada; si deja de
  // nombrarla, se suelta. Lo elegido a mano no se toca.
  useEffect(() => {
    if (equipoAMano || !sugeridos) return;
    const elegida = sugeridos.find((s) => s.elegida) ?? null;
    if (elegida && elegida.id !== equipo?.id) ponerEquipo(elegida, true);
    if (!elegida && porElTexto) ponerEquipo(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugeridos, equipoAMano]);
  const opciones = !equipo && !equipoAMano ? (sugeridos ?? []).filter((s) => !s.elegida) : [];

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

        {veEquipos && (
          <label className="campo">
            Máquina de planta (opcional)
            <ComboEquipo
              key={`planta-${equipoIt?.id ?? 'no'}-${versionCombo}`}
              inicial={equipo}
              onCambio={(e) => {
                setEquipoAMano(true);
                setPorElTexto(false);
                setEquipo(e);
                if (e) setEquipoIt(null);
              }}
            />
            {equipo && porElTexto && (
              <span className="sugerencia-equipo texto-chico">
                <Link2 className="icono" aria-hidden />
                Atada a <strong>{equipo.nombre}</strong> por lo que escribiste.
                <button
                  type="button"
                  className="btn-enlace"
                  onClick={() => {
                    setEquipoAMano(true);
                    ponerEquipo(null, false);
                  }}
                >
                  <X className="icono" aria-hidden />
                  No es esa
                </button>
              </span>
            )}
            {opciones.length > 0 && (
              <span className="sugerencia-equipo texto-chico">
                ¿Es de alguna de estas?
                {opciones.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="chip-periodo"
                    onClick={() => {
                      setEquipoAMano(true);
                      ponerEquipo(s, false);
                    }}
                  >
                    {s.nombre}
                    {s.ubicacionNombre && (
                      <span className="texto-suave"> · {s.ubicacionNombre}</span>
                    )}
                  </button>
                ))}
              </span>
            )}
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
