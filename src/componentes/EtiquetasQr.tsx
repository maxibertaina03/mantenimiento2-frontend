import { useState } from 'react';
import { useMarcarQrGenerado, useTodosLosEquipos } from '@/api/equipos';
import { useCatalogoEquipos } from '@/api/catalogosEquipo';
import { armarEtiquetas, imprimirEtiquetas } from '@/lib/etiquetaQr';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

/**
 * Cuántas etiquetas entran en una tanda: doce hojas A4.
 *
 * Es el mismo tope que acepta el endpoint que las marca como impresas. Los
 * equipos se traen recorriendo páginas, porque el listado no da más de 100 por
 * vez, y después se corta acá.
 */
const MAXIMO_POR_TANDA = 300;

/**
 * Genera las etiquetas con código QR para pegar en las máquinas.
 *
 * El QR lleva la dirección de la ficha del equipo, así que escanearlo con la
 * cámara del celular la abre directamente, con la foto, el historial y los
 * planes.
 *
 * Por defecto ofrece solo las que **todavía no tienen etiqueta**: son 326
 * máquinas y se etiquetan de a tandas, a medida que alguien baja a la planta
 * con las etiquetas impresas. Volver a imprimir las que ya están pegadas es
 * gasto de papel y confusión.
 */
export function EtiquetasQr({ onCerrar }: { onCerrar: () => void }) {
  const { ubicaciones } = useCatalogoEquipos();
  const [ubicacionId, setUbicacionId] = useState('');
  const [soloSinEtiqueta, setSoloSinEtiqueta] = useState(true);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data, isLoading, error } = useTodosLosEquipos({
    ubicacionId: ubicacionId || undefined,
    sinQr: soloSinEtiqueta || undefined,
    ordenarPor: 'ubicacion',
  });
  const marcar = useMarcarQrGenerado();

  const todos = data ?? [];
  const equipos = todos.slice(0, MAXIMO_POR_TANDA);
  const total = todos.length;
  const hayMasQueUnaTanda = total > equipos.length;

  const imprimir = async () => {
    setAviso(null);
    setPreparando(true);
    try {
      const listas = await armarEtiquetas(equipos);
      if (!imprimirEtiquetas(listas)) {
        setAviso(
          'El navegador bloqueó la ventana de impresión. Permitila para este sitio y probá de nuevo.',
        );
        return;
      }
      // Se marcan DESPUÉS de abrir la ventana: si la impresión no se abrió, no
      // tiene sentido dar por etiquetadas máquinas que nadie va a poder pegar.
      await marcar.mutateAsync(equipos.map((e) => e.id));
    } finally {
      setPreparando(false);
    }
  };

  return (
    <Modal titulo="Etiquetas QR" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          Cada etiqueta lleva el nombre de la máquina, su sector y un código QR. Al escanearlo con
          la cámara del celular se abre la ficha del equipo en el sistema.
        </p>

        <div className="fila-campos">
          <div className="campo">
            <label>Sector</label>
            <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)}>
              <option value="">Todos los sectores</option>
              {(ubicaciones.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
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
          Solo las máquinas que todavía no tienen etiqueta
        </label>

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {data && equipos.length === 0 && (
          <EstadoVacio>
            {soloSinEtiqueta
              ? 'Todas las máquinas de este sector ya tienen su etiqueta impresa.'
              : 'No hay equipos en este sector.'}
          </EstadoVacio>
        )}

        {equipos.length > 0 && (
          <>
            <div className="resumen-mantenimiento">
              <span>
                <b>{equipos.length}</b> etiqueta(s) a imprimir
              </span>
              <span className="texto-suave">
                {Math.ceil(equipos.length / 24)} hoja(s) A4, 24 por hoja
              </span>
            </div>

            {hayMasQueUnaTanda && (
              <p className="texto-suave texto-chico">
                Hay {total} máquinas que cumplen el filtro. Se imprimen las primeras{' '}
                {equipos.length}; al terminar, volvé a entrar acá y van a aparecer las que faltan.
              </p>
            )}

            <ul className="lista-catalogo lista-etiquetas">
              {equipos.map((e) => (
                <li key={e.id}>
                  <span>{e.nombre}</span>
                  <span className="texto-suave texto-chico">{e.ubicacionNombre ?? 'sin sector'}</span>
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
            disabled={equipos.length === 0 || preparando || marcar.isPending}
          >
            {preparando ? 'Generando…' : `🖨 Generar e imprimir ${equipos.length}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
