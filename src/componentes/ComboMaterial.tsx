import { useEffect, useRef, useState } from 'react';
import { useMaterial, useMateriales, useTraerMaterial } from '@/api/materiales';
import { formatearNumero } from '@/lib/formato';
import { leerEscaneo, type Escaneo } from '@/lib/escaneo';
import type { Material } from '@/tipos/material';

interface Props {
  /** Id del material seleccionado (puede venir preseleccionado por query param). */
  materialId: string;
  onCambio: (material: Material | null) => void;
  /**
   * Si viene, el combo ofrece dar de alta un material con el texto buscado.
   * Sirve donde el material puede no existir todavía —comprar algo que nunca
   * se compró— sin obligar a salir de la pantalla y perder lo cargado.
   */
  onCrear?: (nombre: string) => void;
  /**
   * Qué hacer con un material escaneado con la pistola, si no es simplemente
   * elegirlo. En la orden de compra lo agrega como renglón y deja el buscador
   * libre para el próximo, que es lo que permite cargar diez seguidos.
   *
   * Sin esto, un escaneo elige el material igual que un clic en la lista.
   */
  onEscaneo?: (material: Material) => void;
  /** Toma el cursor al aparecer, para que el próximo escaneo caiga acá. */
  enfocarAlMontar?: boolean;
}

/**
 * Buscador con autocompletado de materiales. Consulta la API por nombre
 * (soporta cientos de materiales sin cargarlos todos de una).
 *
 * También es por donde entran los escaneos de la pistola: para el navegador un
 * escaneo es alguien tecleando una dirección muy rápido, así que llega como
 * texto a este mismo campo.
 */
export function ComboMaterial({
  materialId,
  onCambio,
  onCrear,
  onEscaneo,
  enfocarAlMontar,
}: Props) {
  const [texto, setTexto] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Material | null>(null);
  /** Por qué un escaneo no se pudo usar. Se muestra al lado del campo. */
  const [avisoEscaneo, setAvisoEscaneo] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const traerMaterial = useTraerMaterial();

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

  // Se ofrece siempre, con o sin texto. Antes solo aparecía al escribir algo, y
  // así la función quedaba invisible justo para quien no sabe que existe.
  const buscado = texto.trim();

  const elegir = (m: Material) => {
    setSeleccionado(m);
    onCambio(m);
    setTexto('');
    setAbierto(false);
  };

  const usarEscaneo = async (escaneo: Escaneo) => {
    // El texto de la dirección no se deja en el campo: no es un nombre de
    // material y buscarlo no devolvería nada.
    setTexto('');

    if (escaneo.clase === 'equipo') {
      setAvisoEscaneo('Ese QR es de un equipo, no de un material.');
      return;
    }

    try {
      // Anotado a mano: el día que la API devuelva `null` en vez de un 404, el
      // material nulo se colaba hasta la orden y reventaba al guardarla.
      const material: Material | null = await traerMaterial(escaneo.id);
      if (!material) {
        setAvisoEscaneo('Ese código no es de ningún material del sistema.');
        return;
      }
      setAvisoEscaneo(null);
      if (onEscaneo) onEscaneo(material);
      else elegir(material);
    } catch {
      // Pasa con la etiqueta de un material borrado, o con un QR de otro
      // sistema que casualmente tenga la forma de un id.
      setAvisoEscaneo('Ese código no es de ningún material del sistema.');
    }
  };

  return (
    <div className="combo" ref={ref}>
      <input
        type="text"
        autoFocus={enfocarAlMontar}
        placeholder={seleccionado ? seleccionado.nombre : '🔍 Buscar material por nombre…'}
        value={abierto ? texto : seleccionado?.nombre ?? ''}
        onFocus={() => {
          setAbierto(true);
          setTexto('');
        }}
        onKeyDown={(e) => {
          // La pistola manda un Enter al final de cada escaneo. Adentro del
          // formulario de la orden ese Enter la crearía a medio cargar, con los
          // renglones que hubiera hasta ese momento.
          if (e.key === 'Enter') e.preventDefault();
        }}
        onChange={(e) => {
          const valor = e.target.value;
          const escaneo = leerEscaneo(valor);
          if (escaneo) {
            void usarEscaneo(escaneo);
            return;
          }
          setTexto(valor);
          setAbierto(true);
        }}
      />
      {avisoEscaneo && <p className="combo-aviso">{avisoEscaneo}</p>}
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
          {!isFetching && data && data.datos.length === 0 && !onCrear && (
            <div className="combo-item texto-suave">Sin resultados</div>
          )}
          {!isFetching && data && data.total > data.datos.length && (
            <div className="combo-item texto-suave" style={{ fontSize: '0.75rem' }}>
              Mostrando {data.datos.length} de {data.total}. Escribí para afinar la búsqueda.
            </div>
          )}
          {!isFetching && data && data.datos.length === 0 && onCrear && (
            <div className="combo-item texto-suave">Sin resultados</div>
          )}
          {/* Pegado al pie de la lista: con veinte resultados, al final habría
              que scrollear para descubrir que se puede crear. */}
          {onCrear && (
            <button
              type="button"
              className="combo-crear"
              onClick={() => {
                setAbierto(false);
                onCrear(buscado);
              }}
            >
              ＋ {buscado ? `Crear el material «${buscado}»` : 'Crear un material nuevo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
