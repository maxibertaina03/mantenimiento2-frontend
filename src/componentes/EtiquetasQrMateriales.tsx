import { useState } from 'react';
import { useMarcarQrMaterial, useTodosLosMateriales } from '@/api/materiales';
import { useCategorias } from '@/api/categorias';
import {
  armarEtiquetasMateriales,
  baseDeLasEtiquetas,
  esDireccionLocal,
  imprimirEtiquetas,
} from '@/lib/etiquetaQr';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

/** Cuántas etiquetas entran en una tanda: doce hojas A4. */
const MAXIMO_POR_TANDA = 300;

/**
 * Etiquetas con código QR para pegar en el estante de cada material.
 *
 * Al escanearla se abre la ficha: cuánto hay ahora, de qué categoría es, su
 * historial de movimientos, y desde ahí se puede cargar una entrada o salida.
 *
 * Por defecto ofrece solo los que **todavía no tienen etiqueta**: son más de
 * novecientos materiales y se etiquetan de a tandas, a medida que alguien
 * recorre el depósito.
 */
export function EtiquetasQrMateriales({ onCerrar }: { onCerrar: () => void }) {
  const { data: categorias } = useCategorias();
  const [categoriaId, setCategoriaId] = useState('');
  const [soloSinEtiqueta, setSoloSinEtiqueta] = useState(true);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data, isLoading, error } = useTodosLosMateriales('activos', {
    sinQr: soloSinEtiqueta || undefined,
    categoriaId: categoriaId || undefined,
  });
  const marcar = useMarcarQrMaterial();

  const todos = data ?? [];
  const materiales = todos.slice(0, MAXIMO_POR_TANDA);
  const base = baseDeLasEtiquetas();
  const direccionInservible = esDireccionLocal(base);
  const hayMasQueUnaTanda = todos.length > materiales.length;

  const imprimir = async () => {
    setAviso(null);
    setPreparando(true);
    try {
      const listas = await armarEtiquetasMateriales(materiales);
      if (!imprimirEtiquetas(listas)) {
        setAviso(
          'El navegador bloqueó la ventana de impresión. Permitila para este sitio y probá de nuevo.',
        );
        return;
      }
      // Se marcan DESPUÉS de abrir la ventana: si la impresión no se abrió, no
      // tiene sentido dar por etiquetados materiales que nadie va a poder pegar.
      await marcar.mutateAsync(materiales.map((m) => m.id));
    } finally {
      setPreparando(false);
    }
  };

  return (
    <Modal titulo="Etiquetas QR de materiales" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          Cada etiqueta lleva el nombre del material, su categoría y un código QR. Al escanearlo se
          abre la ficha: cuánto hay, el historial, y desde ahí se puede cargar un movimiento.
        </p>

        {/* La cantidad NO va impresa y conviene decirlo, porque es lo primero
            que alguien va a esperar ver en la etiqueta. */}
        <div className="alerta alerta-aviso">
          La etiqueta <strong>no lleva la cantidad impresa</strong>. El stock cambia todos los días
          y una etiqueta que dice «quedan 12» miente al día siguiente. La cantidad se ve al
          escanear, siempre actualizada.
        </div>

        <p className="texto-suave texto-chico">
          Los códigos van a apuntar a <code>{base}</code>
        </p>

        {direccionInservible && (
          <div className="alerta alerta-aviso">
            <strong>Esa dirección solo funciona en esta computadora.</strong> Si imprimís así, los
            códigos no van a abrir nada desde el celular. Entrá al sistema por su dirección real y
            generá las etiquetas desde ahí.
          </div>
        )}

        <div className="fila-campos">
          <div className="campo">
            <label>Categoría</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Todas las categorías</option>
              {(categorias ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="filtro-check">
          <input
            type="checkbox"
            checked={soloSinEtiqueta}
            onChange={(e) => setSoloSinEtiqueta(e.target.checked)}
          />
          Solo los materiales que todavía no tienen etiqueta
        </label>

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {data && materiales.length === 0 && (
          <EstadoVacio>
            {soloSinEtiqueta
              ? 'Todos los materiales de esta categoría ya tienen su etiqueta impresa.'
              : 'No hay materiales en esta categoría.'}
          </EstadoVacio>
        )}

        {materiales.length > 0 && (
          <>
            <div className="resumen-mantenimiento">
              <span>
                <b>{materiales.length}</b> etiqueta(s) a imprimir
              </span>
              <span className="texto-suave">
                {Math.ceil(materiales.length / 24)} hoja(s) A4, 24 por hoja
              </span>
            </div>

            {hayMasQueUnaTanda && (
              <p className="texto-suave texto-chico">
                Hay {todos.length} materiales que cumplen el filtro. Se imprimen los primeros{' '}
                {materiales.length}; al terminar, volvé a entrar acá y van a aparecer los que faltan.
              </p>
            )}

            <ul className="lista-catalogo lista-etiquetas">
              {materiales.map((m) => (
                <li key={m.id}>
                  <span>{m.nombre}</span>
                  <span className="texto-suave texto-chico">
                    {m.categoriaNombre ?? 'sin categoría'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {aviso && <div className="alerta alerta-aviso">{aviso}</div>}
        {marcar.error && <MensajeError error={marcar.error} />}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
          <button
            className="btn btn-primario"
            onClick={imprimir}
            disabled={
              materiales.length === 0 || preparando || marcar.isPending || direccionInservible
            }
            title={
              direccionInservible
                ? 'La dirección de los códigos solo funciona en esta computadora'
                : undefined
            }
          >
            {preparando ? 'Generando…' : `🖨 Generar e imprimir ${materiales.length}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
