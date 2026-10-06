import { useState } from 'react';
import {
  MAXIMO_FOTOS_POR_EQUIPO,
  useBorrarFotoDeEquipo,
  useDescribirFoto,
  useFotosDeEquipo,
  useSubirFotoDeEquipo,
  useUsarComoPrincipal,
  type FotoDeEquipo,
} from '@/api/fotos';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { P, usePuede } from '@/lib/permisos';
import { MensajeError } from './Estados';
import { SelectorArchivo } from './SelectorArchivo';
import { VisorFoto } from './VisorFoto';

/**
 * Una chapa característica se lee, no se mira: hay que distinguir un 3 de un 8
 * en la potencia o el número de serie. Por eso estas fotos se achican menos
 * que la principal.
 */
const COMPRESION = { lado: 2400, calidad: 0.85 };

const SUGERENCIAS = ['Chapa característica', 'Placa del motor', 'Tablero', 'Vista de atrás'];

/**
 * Las otras fotos de un equipo, además de la principal: la chapa con los
 * datos, el tablero, lo que haga falta tener a mano.
 *
 * Tocar una la abre grande. Cualquiera puede pasar a ser la principal, y la
 * que era principal queda acá: no se pierde ninguna.
 */
export function OtrasFotosEquipo({
  equipoId,
  nombreEquipo,
  almacenDisponible,
}: {
  equipoId: string;
  nombreEquipo: string;
  almacenDisponible: boolean;
}) {
  const puedeEditar = usePuede()(P.EQUIPOS_EDITAR);
  const fotos = useFotosDeEquipo(equipoId);
  const subir = useSubirFotoDeEquipo(equipoId);
  const describir = useDescribirFoto(equipoId);
  const principal = useUsarComoPrincipal(equipoId);
  const borrar = useBorrarFotoDeEquipo(equipoId);

  const [descripcion, setDescripcion] = useState('');
  const [progreso, setProgreso] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [viendo, setViendo] = useState<FotoDeEquipo | null>(null);
  const [editando, setEditando] = useState<{
    id: string;
    texto: string;
  } | null>(null);

  const lista = fotos.data ?? [];
  if (!almacenDisponible && lista.length === 0) return null;

  const titulo = (f: FotoDeEquipo) => f.descripcion ?? `Foto de ${nombreEquipo}`;
  const lugar = MAXIMO_FOTOS_POR_EQUIPO - lista.length;

  const elegir = async (archivos: File[]) => {
    setErrorLocal(null);
    const aSubir = archivos.slice(0, lugar);
    try {
      for (const [i, archivo] of aSubir.entries()) {
        setProgreso(aSubir.length > 1 ? `Subiendo ${i + 1} de ${aSubir.length}…` : 'Subiendo…');
        const img = await comprimirImagen(archivo, COMPRESION);
        await subir.mutateAsync({
          imagenBase64: img.base64,
          nombreArchivo: img.nombreArchivo,
          descripcion: descripcion.trim() || undefined,
        });
      }
      setDescripcion('');
      if (archivos.length > aSubir.length) {
        setErrorLocal(
          `Se subieron ${aSubir.length}; el máximo son ${MAXIMO_FOTOS_POR_EQUIPO} por equipo.`,
        );
      }
    } catch (error) {
      setErrorLocal(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
    } finally {
      setProgreso(null);
    }
  };

  const guardarDescripcion = async () => {
    if (!editando) return;
    await describir.mutateAsync({
      id: editando.id,
      descripcion: editando.texto,
    });
    setEditando(null);
  };

  const quitar = (f: FotoDeEquipo) => {
    if (!confirm(`¿Borrar la foto «${titulo(f)}»?`)) return;
    borrar.mutate(f.id);
  };

  const error = subir.error ?? describir.error ?? principal.error ?? borrar.error;

  return (
    <div className="campo otras-fotos">
      <span className="otras-fotos-titulo">
        Más fotos
        <span className="texto-suave texto-chico"> · la chapa con los datos, el tablero…</span>
      </span>

      {lista.length > 0 && (
        <ul className="galeria-fotos">
          {lista.map((f) => (
            <li key={f.id} className="galeria-foto">
              <button
                type="button"
                className="galeria-foto-ver"
                onClick={() => setViendo(f)}
                aria-label={`Ver grande: ${titulo(f)}`}
              >
                <img src={f.url} alt={titulo(f)} loading="lazy" />
              </button>

              {editando?.id === f.id ? (
                <form
                  className="galeria-foto-editar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void guardarDescripcion();
                  }}
                >
                  <input
                    className="input"
                    aria-label="Qué se ve en la foto"
                    list="sugerencias-foto"
                    maxLength={100}
                    autoFocus
                    value={editando.texto}
                    onChange={(e) => setEditando({ id: f.id, texto: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setEditando(null)}
                  />
                  <button
                    type="submit"
                    className="btn btn-chico btn-primario"
                    disabled={describir.isPending}
                  >
                    Guardar
                  </button>
                </form>
              ) : (
                <span
                  className={
                    f.descripcion ? 'galeria-foto-nombre' : 'galeria-foto-nombre texto-suave'
                  }
                >
                  {f.descripcion ?? 'Sin descripción'}
                </span>
              )}

              {puedeEditar && editando?.id !== f.id && (
                <div className="galeria-foto-acciones">
                  <button
                    type="button"
                    className="btn btn-chico"
                    title="Escribir qué se ve"
                    aria-label={`Escribir qué se ve en ${titulo(f)}`}
                    onClick={() => setEditando({ id: f.id, texto: f.descripcion ?? '' })}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="btn btn-chico"
                    title="Que sea la foto de la lista. La que está ahora queda acá."
                    disabled={principal.isPending}
                    onClick={() => principal.mutate(f.id)}
                  >
                    ★ Principal
                  </button>
                  <button
                    type="button"
                    className="btn btn-chico btn-peligro"
                    aria-label={`Borrar ${titulo(f)}`}
                    title="Borrar"
                    disabled={borrar.isPending}
                    onClick={() => quitar(f)}
                  >
                    🗑
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && almacenDisponible && lugar > 0 && (
        <div className="otras-fotos-alta">
          <input
            className="input"
            aria-label="Qué se ve en la foto nueva"
            placeholder="¿Qué se ve? Ej: Chapa característica"
            list="sugerencias-foto"
            maxLength={100}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <SelectorArchivo
            accept="image/*"
            icono="📷"
            compacto
            multiple
            titulo="Agregar fotos"
            ayuda="La chapa con los datos, el tablero… Se puede elegir varias."
            ocupado={progreso}
            onElegir={elegir}
          />
        </div>
      )}

      <datalist id="sugerencias-foto">
        {SUGERENCIAS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {errorLocal && <div className="alerta alerta-error">⚠️ {errorLocal}</div>}
      {error && <MensajeError error={error} />}
      {viendo && (
        <VisorFoto url={viendo.url} titulo={titulo(viendo)} alCerrar={() => setViendo(null)} />
      )}
    </div>
  );
}
