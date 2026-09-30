import { useRef, useState } from 'react';
import {
  MAXIMO_BYTES_MANUAL,
  useBorrarManual,
  useEnlaceManual,
  useManuales,
  useSubirManual,
  type Manual,
} from '@/api/manuales';
import { formatearFecha } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { Cargando, MensajeError } from './Estados';

const pesa = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Los manuales en PDF de un equipo o una herramienta: el de uso, el de
 * servicio, el despiece. Para tenerlos a mano frente a la máquina, desde el
 * celular, sin ir a buscar la carpeta.
 */
export function ManualesEquipo({ equipoId }: { equipoId: string }) {
  const puede = usePuede();
  const puedeSubir = puede(P.EQUIPOS_EDITAR);

  const { data, isLoading, error } = useManuales(equipoId);
  const subir = useSubirManual(equipoId);
  const borrar = useBorrarManual(equipoId);
  const enlace = useEnlaceManual();

  const entrada = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const manuales = data?.manuales ?? [];
  // Si el servidor no tiene dónde guardar archivos, no se ofrece subir: prometer
  // algo que va a fallar es peor que no ofrecerlo.
  const disponible = data?.disponible ?? false;

  const alElegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setAviso(null);
    try {
      // Se avisa antes de subir: un PDF de 40 MB tarda en subir desde el
      // celular, y enterarse recién al final de que no entraba es peor.
      if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        setAviso('El manual tiene que ser un PDF.');
        return;
      }
      if (archivo.size > MAXIMO_BYTES_MANUAL) {
        setAviso(
          `El PDF pesa ${pesa(archivo.size)} y el máximo son 25 MB. ` +
            'Si es un escaneo, probá guardarlo con menos calidad.',
        );
        return;
      }
      await subir.mutateAsync(archivo);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo subir el manual.');
    } finally {
      // Sin esto, elegir dos veces el mismo archivo no dispara el evento.
      if (entrada.current) entrada.current.value = '';
    }
  };

  const abrir = async (m: Manual) => {
    setAviso(null);
    // La pestaña se abre YA, en el mismo toque, y después se le carga el
    // enlace. Si se abriera recién cuando llega el enlace, el navegador del
    // celular lo toma como una ventana que nadie pidió y la bloquea.
    const pestania = window.open('', '_blank');
    // Que la pestaña nueva no pueda tocar la del sistema.
    if (pestania) pestania.opener = null;
    try {
      const { url } = await enlace.mutateAsync({ equipoId, id: m.id });
      if (pestania) pestania.location.href = url;
      else window.location.href = url;
    } catch {
      pestania?.close();
      setAviso('No se pudo abrir el manual. Probá de nuevo.');
    }
  };

  const quitar = async (m: Manual) => {
    if (!confirm(`¿Borrar el manual "${m.nombre}"? El archivo se elimina y no se recupera.`)) {
      return;
    }
    setAviso(null);
    try {
      await borrar.mutateAsync(m.id);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo borrar el manual.');
    }
  };

  return (
    <>
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">Manuales</h3>
        {puedeSubir && disponible && (
          <>
            <input
              ref={entrada}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => alElegir(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn btn-chico btn-primario"
              onClick={() => entrada.current?.click()}
              disabled={subir.isPending}
            >
              {subir.isPending ? 'Subiendo…' : '+ Subir manual (PDF)'}
            </button>
          </>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {!isLoading && manuales.length === 0 && (
        <p className="texto-suave texto-chico">
          {disponible
            ? 'Todavía no tiene ningún manual cargado.'
            : 'La carga de manuales no está configurada en el servidor.'}
        </p>
      )}

      {manuales.length > 0 && (
        <ul className="lista-catalogo">
          {manuales.map((m) => (
            <li key={m.id}>
              <span>
                📄 <strong>{m.nombre}</strong>
                <div className="texto-suave texto-chico">
                  {pesa(m.tamanoBytes)} · {formatearFecha(m.subidoEn)}
                  {m.subidoPor ? ` · ${m.subidoPor}` : ''}
                </div>
              </span>
              <span className="acciones-catalogo">
                <button className="btn btn-sm" onClick={() => abrir(m)} disabled={enlace.isPending}>
                  Abrir
                </button>
                {puedeSubir && (
                  <button
                    className="btn btn-sm"
                    onClick={() => quitar(m)}
                    disabled={borrar.isPending}
                  >
                    Borrar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {aviso && <p className="aviso-escaneo es-error">{aviso}</p>}
    </>
  );
}
