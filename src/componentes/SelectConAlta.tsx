import { useState } from 'react';
import { MensajeError } from './Estados';

const AGREGAR = '__agregar__';

interface Props {
  /** Para el lector de pantalla y los tests: «Marca», «Modelo». */
  etiqueta: string;
  valor: string;
  opciones: { id: string; nombre: string }[];
  /** La primera opción, vacía: «Sin marca». */
  vacio: string;
  /** El texto de la opción de alta: «+ Agregar marca…». */
  textoAgregar: string;
  /** Si es false, no se ofrece agregar (falta el permiso). */
  puedeAgregar: boolean;
  disabled?: boolean;
  title?: string;
  onCambio: (id: string) => void;
  /** Crea el ítem y devuelve su id. */
  onAgregar: (nombre: string) => Promise<string>;
}

/**
 * Un desplegable de catálogo que deja cargar lo que falta sin salir del
 * formulario: «+ Agregar marca…» al final de la lista.
 *
 * Así los catálogos se llenan solos, a medida que se cargan los equipos. Antes
 * el desplegable de marca de planta estaba vacío y no había forma de llenarlo
 * desde la ficha: había que saber que existía la pantalla de catálogos.
 */
export function SelectConAlta({
  etiqueta,
  valor,
  opciones,
  vacio,
  textoAgregar,
  puedeAgregar,
  disabled,
  title,
  onCambio,
  onAgregar,
}: Props) {
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const cancelar = () => {
    setAgregando(false);
    setNombre('');
    setError(null);
  };

  const confirmar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    setGuardando(true);
    setError(null);
    try {
      const id = await onAgregar(limpio);
      onCambio(id);
      cancelar();
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  };

  if (agregando) {
    return (
      <div className="alta-en-linea">
        <div className="alta-en-linea-fila">
          <input
            autoFocus
            aria-label={`Nombre de la ${etiqueta.toLowerCase()} nueva`}
            value={nombre}
            maxLength={100}
            placeholder={`Nombre de la ${etiqueta.toLowerCase()}`}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              // Enter guarda esto, no el formulario entero de afuera.
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmar();
              }
              if (e.key === 'Escape') cancelar();
            }}
          />
          <button
            type="button"
            className="btn btn-primario"
            disabled={guardando || !nombre.trim()}
            onClick={() => void confirmar()}
          >
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>
          <button type="button" className="btn" onClick={cancelar}>
            Cancelar
          </button>
        </div>
        {error !== null && <MensajeError error={error} />}
      </div>
    );
  }

  return (
    <select
      aria-label={etiqueta}
      value={valor}
      disabled={disabled}
      title={title}
      onChange={(e) => {
        if (e.target.value === AGREGAR) setAgregando(true);
        else onCambio(e.target.value);
      }}
    >
      <option value="">{vacio}</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
      {puedeAgregar && <option value={AGREGAR}>{textoAgregar}</option>}
    </select>
  );
}
