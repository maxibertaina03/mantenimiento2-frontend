import { useEffect, useRef, useState } from 'react';
import { useMaterial, useMateriales } from '@/api/materiales';
import { formatearNumero } from '@/lib/formato';
import type { Material } from '@/tipos/material';

interface Props {
  /** Id del material seleccionado (puede venir preseleccionado por query param). */
  materialId: string;
  onCambio: (material: Material | null) => void;
}

/**
 * Buscador con autocompletado de materiales. Consulta la API por nombre
 * (soporta cientos de materiales sin cargarlos todos de una).
 */
export function ComboMaterial({ materialId, onCambio }: Props) {
  const [texto, setTexto] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Material | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Si viene un material preseleccionado (ej: desde el detalle), lo traemos para mostrar su nombre.
  const { data: materialInicial } = useMaterial(materialId);
  useEffect(() => {
    if (materialInicial && !seleccionado) setSeleccionado(materialInicial);
  }, [materialInicial, seleccionado]);

  // Debounce del texto de búsqueda.
  useEffect(() => {
    const t = setTimeout(() => setBusq(texto), 250);
    return () => clearTimeout(t);
  }, [texto]);

  // Cerrar el desplegable al hacer clic afuera.
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const { data, isFetching } = useMateriales(1, 20, abierto ? busq : '');

  const elegir = (m: Material) => {
    setSeleccionado(m);
    onCambio(m);
    setTexto('');
    setAbierto(false);
  };

  return (
    <div className="combo" ref={ref}>
      <input
        type="text"
        placeholder={seleccionado ? seleccionado.nombre : '🔍 Buscar material por nombre…'}
        value={abierto ? texto : seleccionado?.nombre ?? ''}
        onFocus={() => {
          setAbierto(true);
          setTexto('');
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && (
        <div className="combo-lista">
          {isFetching && <div className="combo-item texto-suave">Buscando…</div>}
          {!isFetching &&
            data?.datos.map((m) => (
              <button type="button" key={m.id} className="combo-item" onClick={() => elegir(m)}>
                {m.nombre}{' '}
                <span className="texto-suave">
                  — stock {formatearNumero(m.stockActual)} {m.unidad}
                </span>
              </button>
            ))}
          {!isFetching && data && data.datos.length === 0 && (
            <div className="combo-item texto-suave">Sin resultados</div>
          )}
          {!isFetching && data && data.total > data.datos.length && (
            <div className="combo-item texto-suave" style={{ fontSize: '0.75rem' }}>
              Mostrando {data.datos.length} de {data.total}. Escribí para afinar la búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
