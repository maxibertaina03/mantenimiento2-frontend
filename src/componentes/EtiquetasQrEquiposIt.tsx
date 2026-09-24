import { useState } from 'react';
import { useMarcarQrGeneradoIt, useTodosLosEquiposIt, useTiposEquipo } from '@/api/equiposIt';
import {
  armarEtiquetasEquiposIt,
  baseDeLasEtiquetas,
  esDireccionLocal,
  etiquetasPorHoja,
  FORMATOS,
  imprimirEtiquetas,
  nombreDeEquipoIt,
} from '@/lib/etiquetaQr';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

/** El mismo formato que las máquinas de planta: 60 × 34 mm, 21 por hoja A4. */
const POR_HOJA = etiquetasPorHoja(FORMATOS.equipo);

/** Doce hojas A4. Es el mismo tope que acepta el endpoint que las marca. */
const MAXIMO_POR_TANDA = 300;

/**
 * Las etiquetas con código QR de los equipos de informática.
 *
 * Escanear la etiqueta de una PC con el celular abre su ficha: quién la tiene,
 * qué tiene adentro, sus claves y los trabajos que se le hicieron. Es lo que
 * hace falta cuando alguien está parado delante de la máquina y no sabe cuál
 * es cuál: son 65 equipos y varios son el mismo modelo.
 *
 * Por defecto ofrece solo las que todavía no tienen etiqueta. Reimprimir las
 * pegadas es papel y confusión.
 */
export function EtiquetasQrEquiposIt({ onCerrar }: { onCerrar: () => void }) {
  const tipos = useTiposEquipo(true);
  const [tipoId, setTipoId] = useState('');
  const [soloSinEtiqueta, setSoloSinEtiqueta] = useState(true);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data, isLoading, error } = useTodosLosEquiposIt({
    tipoId: tipoId || undefined,
    sinQr: soloSinEtiqueta || undefined,
  });
  const marcar = useMarcarQrGeneradoIt();

  const todos = data ?? [];
  const equipos = todos.slice(0, MAXIMO_POR_TANDA);
  const base = baseDeLasEtiquetas();
  const direccionInservible = esDireccionLocal(base);
  const hayMasQueUnaTanda = todos.length > equipos.length;

  const imprimir = async () => {
    setAviso(null);
    setPreparando(true);
    try {
      const listas = await armarEtiquetasEquiposIt(equipos);
      if (!imprimirEtiquetas(listas)) {
        setAviso(
          'El navegador bloqueó la ventana de impresión. Permitila para este sitio y probá de nuevo.',
        );
        return;
      }
      // Se marcan DESPUÉS de abrir la ventana: si la impresión no se abrió, no
      // tiene sentido dar por etiquetados equipos que nadie va a poder pegar.
      await marcar.mutateAsync(equipos.map((e) => e.id));
    } finally {
      setPreparando(false);
    }
  };

  return (
    <Modal titulo="Etiquetas QR de informática" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          Cada etiqueta lleva el equipo, su lugar y un código QR. Al escanearlo con la cámara del
          celular se abre su ficha, con las claves y los trabajos que se le hicieron.
        </p>

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
            <label htmlFor="etiquetas-tipo">Tipo de equipo</label>
            <select id="etiquetas-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              <option value="">Todos los tipos</option>
              {(tipos.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
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
          Solo los equipos que todavía no tienen etiqueta
        </label>

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {data && equipos.length === 0 && (
          <EstadoVacio>
            {soloSinEtiqueta
              ? 'Todos los equipos de este tipo ya tienen su etiqueta impresa.'
              : 'No hay equipos de este tipo.'}
          </EstadoVacio>
        )}

        {equipos.length > 0 && (
          <>
            <div className="resumen-mantenimiento">
              <span>
                <b>{equipos.length}</b> etiqueta(s) a imprimir
              </span>
              <span className="texto-suave">
                {Math.ceil(equipos.length / POR_HOJA)} hoja(s) A4, {POR_HOJA} por hoja
              </span>
            </div>

            {hayMasQueUnaTanda && (
              <p className="texto-suave texto-chico">
                Hay {todos.length} equipos que cumplen el filtro. Se imprimen los primeros{' '}
                {equipos.length}; al terminar, volvé a entrar acá y van a aparecer los que faltan.
              </p>
            )}

            <ul className="lista-catalogo lista-etiquetas">
              {equipos.map((e) => (
                <li key={e.id}>
                  <span>{nombreDeEquipoIt(e)}</span>
                  <span className="texto-suave texto-chico">
                    {e.ubicacionNombre ?? 'sin lugar'}
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
            disabled={equipos.length === 0 || preparando || marcar.isPending || direccionInservible}
            title={
              direccionInservible
                ? 'La dirección de los códigos solo funciona en esta computadora'
                : undefined
            }
          >
            {preparando ? 'Generando…' : `🖨 Generar e imprimir ${equipos.length}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
