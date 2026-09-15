import { useRef, useState } from 'react';
import {
  TIPOS_COMPROBANTE,
  useAdjuntarComprobante,
  useBorrarComprobante,
  useComprobantes,
  useEnlaceComprobante,
  type Comprobante,
  type TipoComprobante,
} from '@/api/comprobantes';
import { EXTENSIONES, esAceptado, leerComprobante } from '@/lib/leerComprobante';
import { formatearFecha } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { Cargando, MensajeError } from './Estados';

const pesa = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * El PDF o la foto del remito y de la factura de una orden.
 *
 * El número ya se guardaba; esto guarda el papel. Sirve para comparar contra el
 * físico sin tenerlo a mano, y para que quede algo cuando el original se
 * archiva, se pierde o se moja.
 */
export function ComprobantesOrden({ ordenId }: { ordenId: string }) {
  const puede = usePuede();
  const puedeAdjuntar = puede(P.ORDENES_RECIBIR);

  const { data, isLoading, error } = useComprobantes(ordenId);
  const adjuntar = useAdjuntarComprobante(ordenId);
  const borrar = useBorrarComprobante(ordenId);
  const enlace = useEnlaceComprobante();

  const entrada = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoComprobante>('REMITO');
  const [aviso, setAviso] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);

  const comprobantes = data ?? [];

  const alElegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setAviso(null);

    if (!esAceptado(archivo)) {
      setAviso(`Ese archivo no se puede adjuntar. Se aceptan: ${EXTENSIONES.join(', ')}.`);
      return;
    }

    setPreparando(true);
    try {
      const listo = await leerComprobante(archivo);
      await adjuntar.mutateAsync({
        archivoBase64: listo.archivoBase64,
        nombreArchivo: listo.nombreArchivo,
        tipo,
      });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      setPreparando(false);
      // Sin esto, elegir dos veces el mismo archivo no dispara el evento y
      // parece que el botón dejó de andar.
      if (entrada.current) entrada.current.value = '';
    }
  };

  const abrir = async (c: Comprobante) => {
    setAviso(null);
    try {
      const { url } = await enlace.mutateAsync({ ordenId, id: c.id });
      // En una pestaña nueva: el enlace vence, y si se abriera en la misma, al
      // volver atrás quedaría una dirección que ya no sirve.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setAviso('No se pudo abrir el archivo. Probá de nuevo.');
    }
  };

  const quitar = async (c: Comprobante) => {
    if (!confirm(`¿Borrar "${c.nombre}"? El archivo se elimina y no se recupera.`)) return;
    await borrar.mutateAsync(c.id);
  };

  return (
    <>
      <h3 className="subtitulo-form">Comprobantes adjuntos</h3>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {comprobantes.length === 0 && !isLoading && (
        <p className="texto-suave texto-chico">
          Todavía no hay ningún remito ni factura adjunto.
          {puedeAdjuntar ? ' Sacale una foto o subí el PDF.' : ''}
        </p>
      )}

      {comprobantes.length > 0 && (
        <ul className="lista-catalogo">
          {comprobantes.map((c) => (
            <li key={c.id}>
              <span>
                {c.esImagen ? '🖼' : '📄'} <strong>{c.nombre}</strong>
                <div className="texto-suave texto-chico">
                  {TIPOS_COMPROBANTE.find((t) => t.valor === c.tipo)?.etiqueta ?? c.tipo} ·{' '}
                  {pesa(c.tamanoBytes)} · {formatearFecha(c.subidoEn)}
                  {c.subidoPor ? ` · ${c.subidoPor}` : ''}
                </div>
              </span>
              <span className="acciones-catalogo">
                <button
                  className="btn btn-sm"
                  onClick={() => abrir(c)}
                  disabled={enlace.isPending}
                >
                  {enlace.isPending ? 'Abriendo…' : 'Ver'}
                </button>
                {puedeAdjuntar && (
                  <button className="btn btn-sm" onClick={() => quitar(c)} disabled={borrar.isPending}>
                    Borrar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {puedeAdjuntar && (
        <div className="alta-rapida" style={{ marginTop: '0.6rem' }}>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoComprobante)}
            aria-label="Tipo de comprobante"
          >
            {TIPOS_COMPROBANTE.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
          <input
            ref={entrada}
            type="file"
            accept=".pdf,image/*"
            style={{ display: 'none' }}
            onChange={(e) => alElegir(e.target.files?.[0])}
          />
          <button
            className="btn"
            onClick={() => entrada.current?.click()}
            disabled={preparando || adjuntar.isPending}
          >
            {preparando || adjuntar.isPending ? 'Subiendo…' : '📎 Adjuntar archivo'}
          </button>
        </div>
      )}

      {puedeAdjuntar && (
        <p className="texto-suave texto-chico">
          PDF o foto, hasta 10 MB. Las fotos se achican solas antes de subirlas, con la
          resolución suficiente para leer los números.
        </p>
      )}

      {aviso && <div className="alerta alerta-aviso">{aviso}</div>}
      {adjuntar.error && <MensajeError error={adjuntar.error} />}
      {borrar.error && <MensajeError error={borrar.error} />}
    </>
  );
}
