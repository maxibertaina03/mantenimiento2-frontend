import { useEffect, useRef, useState } from 'react';
import { useProveedores } from '@/api/proveedores';
import type { Proveedor } from '@/tipos/proveedor';

interface Props {
  onCambio: (proveedor: Proveedor | null) => void;
}

/**
 * Buscador con autocompletado de proveedores (por nombre o CUIT).
 * Consulta la API; soporta miles de proveedores sin cargarlos todos.
 */
export function ComboProveedor({ onCambio }: Props) {
  const [texto, setTexto] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Proveedor | null>(null);
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

  const { data, isFetching } = useProveedores(1, 20, abierto ? busq : '');

  const elegir = (p: Proveedor | null) => {
    setSeleccionado(p);
    onCambio(p);
    setTexto('');
    setAbierto(false);
  };

  return (
    <div className="combo" ref={ref}>
      <input
        type="text"
        placeholder={seleccionado ? seleccionado.nombre : '🔍 Buscar proveedor (nombre o CUIT)…'}
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
          <button type="button" className="combo-item texto-suave" onClick={() => elegir(null)}>
            — Sin proveedor —
          </button>
          {isFetching && <div className="combo-item texto-suave">Buscando…</div>}
          {!isFetching &&
            data?.datos.map((p) => (
              <button type="button" key={p.id} className="combo-item" onClick={() => elegir(p)}>
                {p.nombre}
                {p.cuit && <span className="texto-suave"> — {p.cuit}</span>}
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
