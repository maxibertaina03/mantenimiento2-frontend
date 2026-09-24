import { useEffect, useRef, useState } from 'react';
import { useEquipos } from '@/api/equiposIt';
import { leerEscaneo } from '@/lib/escaneo';
import type { ClaseEscaneo } from '@/lib/escaneo';
import { nombreDeEquipoIt } from '@/lib/etiquetaQr';
import type { EquipoIt } from '@/tipos/equipoIt';

interface Props {
  /** El equipo ya elegido, para mostrarlo al abrir algo que lo tenía. */
  inicial?: { id: string; nombre: string } | null;
  onCambio: (equipo: { id: string; nombre: string } | null) => void;
}

/**
 * Buscador de equipos de informática.
 *
 * Es el hermano de `ComboEquipo`, contra el otro inventario. Son dos y no uno
 * con un selector de tipo adentro porque son dos tablas distintas y cada campo
 * espera una de las dos: un solo buscador tendría que devolver "este id, de
 * esta clase" y todos los que lo usan deberían preguntar cuál vino.
 *
 * Acepta la pistola, igual que el otro: apuntar a la etiqueta del gabinete lo
 * deja elegido, que es lo más rápido cuando se está parado delante del equipo.
 */
export function ComboEquipoIt({ inicial = null, onCambio }: Props) {
  const [texto, setTexto] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<{ id: string; nombre: string } | null>(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setBusq(texto), 250);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const { data, isFetching } = useEquipos(1, 20, { buscar: abierto ? busq : '' });

  const elegir = (equipo: { id: string; nombre: string } | null) => {
    setSeleccionado(equipo);
    onCambio(equipo);
    setTexto('');
    setAviso(null);
    setAbierto(false);
  };

  /**
   * El escaneo trae el id, no el nombre, así que se busca en lo que ya vino. Si
   * no está —porque el filtro de texto tiene la lista recortada— se elige igual
   * por id: el backend valida que exista, y el nombre aparece al guardar.
   */
  const usarEscaneo = (id: string, clase: ClaseEscaneo) => {
    setTexto('');
    if (clase === 'material') {
      setAviso('Ese QR es de un material, no de un equipo.');
      return;
    }
    if (clase === 'equipo') {
      setAviso('Ese QR es de una máquina de planta. Este campo es para los equipos de informática.');
      return;
    }
    const encontrado = (data?.datos ?? []).find((e: EquipoIt) => e.id === id);
    elegir({ id, nombre: encontrado ? nombreDeEquipoIt(encontrado) : 'Equipo escaneado' });
  };

  return (
    <div className="combo" ref={ref}>
      <input
        type="text"
        placeholder={seleccionado ? seleccionado.nombre : '🔍 Buscar equipo, o escaneá su QR…'}
        value={abierto ? texto : (seleccionado?.nombre ?? '')}
        onFocus={() => {
          setAbierto(true);
          setTexto('');
        }}
        onKeyDown={(e) => {
          // La pistola manda Enter al final de cada escaneo, y adentro de un
          // formulario ese Enter lo enviaría a medio llenar.
          if (e.key === 'Enter') e.preventDefault();
        }}
        onChange={(e) => {
          const escaneo = leerEscaneo(e.target.value);
          if (escaneo) {
            usarEscaneo(escaneo.id, escaneo.clase);
            return;
          }
          setTexto(e.target.value);
          setAbierto(true);
        }}
      />
      {aviso && <p className="combo-aviso">{aviso}</p>}
      {abierto && (
        <div className="combo-lista">
          <button type="button" className="combo-item texto-suave" onClick={() => elegir(null)}>
            — Sin equipo —
          </button>
          {isFetching && <div className="combo-item texto-suave">Buscando…</div>}
          {!isFetching &&
            (data?.datos ?? []).map((e: EquipoIt) => (
              <button
                type="button"
                key={e.id}
                className="combo-item"
                onClick={() => elegir({ id: e.id, nombre: nombreDeEquipoIt(e) })}
              >
                {nombreDeEquipoIt(e)}
                {e.codigoInterno && <span className="texto-suave"> — {e.codigoInterno}</span>}
              </button>
            ))}
          {!isFetching && data && data.datos.length === 0 && (
            <div className="combo-item texto-suave">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}
