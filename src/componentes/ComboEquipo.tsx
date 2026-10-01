import { useEffect, useRef, useState } from 'react';
import { useEquipos } from '@/api/equipos';
import { leerEscaneo } from '@/lib/escaneo';
import type { ClaseEscaneo } from '@/lib/escaneo';
import type { Equipo } from '@/tipos/equipo';

interface Props {
  /** El equipo ya elegido, para mostrarlo al abrir una orden que lo tenía. */
  inicial?: { id: string; nombre: string } | null;
  onCambio: (equipo: { id: string; nombre: string } | null) => void;
}

type Elegido = { id: string; nombre: string; fotoUrl?: string | null };

/**
 * La foto chica del equipo. Muchos se llaman parecido («Bomba 2», «Bomba de
 * agua saladero»): con la foto se reconoce la máquina sin leer.
 */
function Miniatura({ url }: { url: string | null | undefined }) {
  return url ? (
    <img src={url} alt="" className="combo-foto" loading="lazy" />
  ) : (
    <span className="combo-foto combo-foto-vacia" aria-hidden="true" />
  );
}

/**
 * Buscador de equipos de planta.
 *
 * Con 326 máquinas un desplegable es inusable: hay que poder escribir. Y como
 * cada máquina tiene su etiqueta QR pegada, también se puede apuntar la pistola
 * a la chapa y queda elegida, que es lo más rápido cuando se está parado al
 * lado del equipo que se acaba de arreglar.
 */
export function ComboEquipo({ inicial = null, onCambio }: Props) {
  const [texto, setTexto] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Elegido | null>(inicial);
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

  const elegir = (equipo: Elegido | null) => {
    setSeleccionado(equipo);
    onCambio(equipo ? { id: equipo.id, nombre: equipo.nombre } : null);
    setTexto('');
    setAviso(null);
    setAbierto(false);
  };

  /**
   * Un escaneo trae el id, no el nombre, así que hay que buscarlo en la lista
   * que ya vino. Si no está —porque el filtro de texto la tiene recortada— se
   * pide por id: con 326 equipos, el que se escaneó casi nunca está entre los
   * veinte que se están mostrando.
   */
  const usarEscaneo = (id: string, clase: ClaseEscaneo) => {
    setTexto('');
    if (clase === 'material') {
      setAviso('Ese QR es de un material, no de un equipo.');
      return;
    }
    // Desde que los equipos de informatica tambien tienen etiqueta, este campo
    // puede recibir la de una PC. Aceptarla guardaria un id que no existe en
    // esta tabla, y el error recien aparece al guardar, con un mensaje que no
    // explica nada.
    if (clase === 'equipo-it') {
      setAviso('Ese QR es de un equipo de informatica. Este campo es para las maquinas de planta.');
      return;
    }
    const encontrado = (data?.datos ?? []).find((e: Equipo) => e.id === id);
    if (encontrado) {
      elegir({ id: encontrado.id, nombre: encontrado.nombre, fotoUrl: encontrado.fotoUrl });
      return;
    }
    // Se elige igual: el backend valida que exista, y el nombre aparece al
    // guardar. Peor sería rechazar un equipo que existe solo porque no entró
    // en la página que se estaba mostrando.
    elegir({ id, nombre: 'Equipo escaneado' });
  };

  return (
    <div className="combo" ref={ref}>
      <div className="combo-entrada">
        {!abierto && seleccionado?.fotoUrl && <Miniatura url={seleccionado.fotoUrl} />}
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
      </div>
      {aviso && <p className="combo-aviso">{aviso}</p>}
      {abierto && (
        <div className="combo-lista">
          <button type="button" className="combo-item texto-suave" onClick={() => elegir(null)}>
            — Sin equipo —
          </button>
          {isFetching && <div className="combo-item texto-suave">Buscando…</div>}
          {!isFetching &&
            (data?.datos ?? []).map((e: Equipo) => (
              <button
                type="button"
                key={e.id}
                className="combo-item combo-item-con-foto"
                onClick={() => elegir({ id: e.id, nombre: e.nombre, fotoUrl: e.fotoUrl })}
              >
                <Miniatura url={e.fotoUrl} />
                <span>
                  {e.nombre}
                  {e.ubicacionNombre && <span className="texto-suave"> — {e.ubicacionNombre}</span>}
                </span>
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
