import { useState } from 'react';

interface Opcion {
  id: string;
  nombre: string;
  activo?: boolean;
}

/**
 * Un desplegable de catálogo que además deja cargar un valor nuevo sin salir
 * del formulario.
 *
 * Es lo que hace que el catálogo se pueda usar. Si para cargar una marca que
 * falta hubiera que cerrar el formulario, ir a otra pantalla, cargarla y
 * volver a empezar, nadie lo haría: escribirían cualquier cosa, que es
 * exactamente lo que el catálogo viene a evitar.
 *
 * Los items desactivados no se ofrecen, salvo que sea el que ya tiene el
 * equipo: sacarle de golpe el valor a una ficha vieja sería peor.
 */
export function SelectorCatalogo({
  etiqueta,
  valor,
  opciones,
  onCambiar,
  onCrear,
  creando = false,
  deshabilitado = false,
  ayuda,
  placeholder = 'Sin asignar',
  placeholderNuevo = 'Nombre del nuevo',
  id,
}: {
  etiqueta: string;
  valor: string;
  opciones: Opcion[];
  onCambiar: (id: string) => void;
  /** Da de alta el item y devuelve su id, para dejarlo elegido. */
  onCrear: (nombre: string) => Promise<string>;
  creando?: boolean;
  deshabilitado?: boolean;
  ayuda?: string;
  placeholder?: string;
  placeholderNuevo?: string;
  id: string;
}) {
  const [cargandoNuevo, setCargandoNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visibles = opciones.filter((o) => o.activo !== false || o.id === valor);

  const confirmar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    setError(null);
    try {
      const nuevoId = await onCrear(limpio);
      onCambiar(nuevoId);
      setNombre('');
      setCargandoNuevo(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear.');
    }
  };

  if (cargandoNuevo) {
    return (
      <div className="campo">
        <label htmlFor={`${id}-nuevo`}>{etiqueta}</label>
        <div className="alta-rapida">
          <input
            id={`${id}-nuevo`}
            value={nombre}
            autoFocus
            placeholder={placeholderNuevo}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmar();
              }
              // Escape vuelve al desplegable sin cargar nada: entrar por error
              // al modo "nuevo" no tiene que dejar a nadie atrapado.
              if (e.key === 'Escape') {
                e.preventDefault();
                setCargandoNuevo(false);
                setNombre('');
                setError(null);
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primario btn-sm"
            onClick={confirmar}
            disabled={!nombre.trim() || creando}
          >
            {creando ? 'Guardando…' : 'Agregar'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setCargandoNuevo(false);
              setNombre('');
              setError(null);
            }}
          >
            Cancelar
          </button>
        </div>
        {error && <span className="badge badge-error texto-chico">{error}</span>}
      </div>
    );
  }

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="alta-rapida">
        <select
          id={id}
          value={valor}
          disabled={deshabilitado}
          onChange={(e) => onCambiar(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {visibles.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
              {o.activo === false ? ' (desactivado)' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-sm"
          disabled={deshabilitado}
          onClick={() => setCargandoNuevo(true)}
          title={`Cargar ${etiqueta.toLowerCase()} que no esté en la lista`}
        >
          + Nueva
        </button>
      </div>
      {ayuda && <span className="texto-suave texto-chico">{ayuda}</span>}
    </div>
  );
}
