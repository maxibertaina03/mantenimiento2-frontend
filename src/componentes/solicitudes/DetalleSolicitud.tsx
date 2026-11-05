import { Check, ClipboardPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAsignables } from '@/api/ordenesTrabajo';
import {
  pedirFotoSolicitud,
  useGenerarOrdenDeSolicitud,
  useRechazarSolicitud,
  useResolverSolicitud,
} from '@/api/solicitudes';
import { useUsuarioActual } from '@/api/usuarios';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import {
  CLASE_ESTADO_SOLICITUD,
  ETIQUETA_ESTADO_SOLICITUD,
  ETIQUETA_URGENCIA,
  type Solicitud,
} from '@/tipos/solicitud';

type Accion = 'orden' | 'resolver' | 'rechazar' | null;

/** El título que se propone para la orden: el principio de lo que contó el sector. */
const tituloPropuesto = (s: Solicitud) => {
  const texto = s.descripcion.replace(/\s+/g, ' ').trim();
  return texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
};

/**
 * Una solicitud: qué pidió el sector, con sus fotos, y qué pasó con ella.
 *
 * Quien la revisa (`solicitudes.gestionar`) la convierte en orden de trabajo,
 * la resuelve sin orden si era algo menor, o la rechaza diciendo por qué. El
 * sector ve lo mismo, sin los botones.
 */
export function DetalleSolicitud({
  solicitud: s,
  onCerrar,
}: {
  solicitud: Solicitud;
  onCerrar: () => void;
}) {
  const puede = usePuede();
  const { data: yo } = useUsuarioActual();
  const gestiona = puede(P.SOLICITUDES_GESTIONAR);
  const [accion, setAccion] = useState<Accion>(null);
  const [titulo, setTitulo] = useState(() => tituloPropuesto(s));
  const [asignadoAId, setAsignadoAId] = useState('');
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  const { data: asignables } = useAsignables(gestiona && s.estado === 'NUEVA');
  const generar = useGenerarOrdenDeSolicitud();
  const rechazar = useRechazarSolicitud();
  const resolver = useResolverSolicitud();

  // Quien la revisa suele ser quien la va a hacer: viene elegido.
  useEffect(() => {
    if (!asignadoAId && yo && asignables?.some((a) => a.id === yo.id)) setAsignadoAId(yo.id);
  }, [asignables, yo, asignadoAId]);

  // Los enlaces de las fotos vencen: se piden al abrir.
  useEffect(() => {
    let vigente = true;
    void Promise.all(
      s.fotos.map(async (f) => ({ id: f.id, url: (await pedirFotoSolicitud(s.id, f.id)).url })),
    )
      .then((lista) => vigente && setFotos(lista))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [s.id, s.fotos]);

  const error = generar.error ?? rechazar.error ?? resolver.error;
  const ocupado = generar.isPending || rechazar.isPending || resolver.isPending;

  return (
    <Modal titulo={`Solicitud ${s.numero}`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal detalle-solicitud">
        <p>
          <span className={CLASE_ESTADO_SOLICITUD[s.estado]}>
            {ETIQUETA_ESTADO_SOLICITUD[s.estado]}
          </span>{' '}
          {s.urgencia === 'URGENTE' && (
            <span className="badge badge-error">{ETIQUETA_URGENCIA.URGENTE}</span>
          )}
          {s.urgencia === 'BAJA' && <span className="badge">Urgencia baja</span>}
        </p>
        <p className="texto-suave">
          <strong>{s.sectorNombre}</strong>
          {s.equipoNombre && ` · ${s.equipoNombre}`} · {formatearFecha(s.creadoEn)}
          {s.solicitadaPorNombre && ` · cargó ${s.solicitadaPorNombre}`}
        </p>
        <p className="detalle-solicitud-texto">{s.descripcion}</p>

        {s.fotos.length > 0 && (
          <div className="fotos-solicitud">
            {s.fotos.map((f, i) => {
              const url = fotos.find((x) => x.id === f.id)?.url;
              return url ? (
                <a key={f.id} href={url} target="_blank" rel="noreferrer" className="foto-solicitud">
                  <img src={url} alt={`Foto ${i + 1} de la solicitud`} />
                </a>
              ) : (
                <div key={f.id} className="foto-solicitud foto-solicitud-cargando">
                  Foto {i + 1}…
                </div>
              );
            })}
          </div>
        )}

        {s.ordenTrabajoNumero && (
          <p className="aviso-escaneo">
            Orden de trabajo <strong>{s.ordenTrabajoNumero}</strong>
            {s.ordenTrabajoAsignadoANombre && `, a cargo de ${s.ordenTrabajoAsignadoANombre}`}
            {s.revisadaPorNombre && ` (la generó ${s.revisadaPorNombre})`}.
          </p>
        )}
        {s.estado === 'RESUELTA' && s.notaResolucion && (
          <div className="alerta alerta-exito">
            <Check className="icono" aria-hidden />
            Resuelta{s.resueltaEn ? ` el ${formatearFecha(s.resueltaEn)}` : ''}: {s.notaResolucion}
          </div>
        )}
        {s.estado === 'RECHAZADA' && (
          <div className="alerta alerta-aviso">
            Rechazada{s.revisadaPorNombre ? ` por ${s.revisadaPorNombre}` : ''}: {s.motivoRechazo}
          </div>
        )}

        {gestiona && s.estado === 'NUEVA' && accion === null && (
          <div className="acciones acciones-solicitud">
            <button type="button" className="btn btn-peligro" onClick={() => setAccion('rechazar')}>
              <X className="icono" aria-hidden />
              Rechazar
            </button>
            <button type="button" className="btn" onClick={() => setAccion('resolver')}>
              <Check className="icono" aria-hidden />
              Resolver sin orden
            </button>
            {puede(P.TRABAJOS_EDITAR) && (
              <button type="button" className="btn btn-primario" onClick={() => setAccion('orden')}>
                <ClipboardPlus className="icono" aria-hidden />
                Generar orden de trabajo
              </button>
            )}
          </div>
        )}

        {accion === 'orden' && (
          <div className="caja-accion">
            <label className="campo">
              Título de la orden
              <input value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label className="campo">
              Quién la hace
              <select value={asignadoAId} onChange={(e) => setAsignadoAId(e.target.value)}>
                <option value="">Elegí a quién</option>
                {asignables?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <p className="texto-suave texto-chico">
              Va como correctivo, sobre {s.equipoNombre ?? `el sector ${s.sectorNombre}`}, con lo que
              contó el sector. Al cerrarla, la solicitud queda resuelta sola.
            </p>
            <div className="acciones">
              <button type="button" className="btn" onClick={() => setAccion(null)}>
                Volver
              </button>
              <button
                type="button"
                className="btn btn-primario"
                disabled={titulo.trim().length < 3 || !asignadoAId || ocupado}
                onClick={() =>
                  generar.mutate(
                    { id: s.id, titulo: titulo.trim(), asignadoAId },
                    { onSuccess: onCerrar },
                  )
                }
              >
                {generar.isPending ? 'Generando…' : 'Generar la orden'}
              </button>
            </div>
          </div>
        )}

        {(accion === 'rechazar' || accion === 'resolver') && (
          <div className="caja-accion">
            <label className="campo">
              {accion === 'rechazar' ? '¿Por qué se rechaza?' : '¿Qué se hizo?'}
              <textarea
                rows={3}
                maxLength={500}
                value={texto}
                placeholder={
                  accion === 'rechazar'
                    ? 'Ej.: no es de mantenimiento, lo ve sistemas'
                    : 'Ej.: se ajustó la abrazadera, ya no pierde'
                }
                onChange={(e) => setTexto(e.target.value)}
              />
            </label>
            <p className="texto-suave texto-chico">El sector lo va a ver en su solicitud.</p>
            <div className="acciones">
              <button type="button" className="btn" onClick={() => setAccion(null)}>
                Volver
              </button>
              <button
                type="button"
                className={`btn ${accion === 'rechazar' ? 'btn-peligro' : 'btn-primario'}`}
                disabled={texto.trim().length < 3 || ocupado}
                onClick={() =>
                  (accion === 'rechazar' ? rechazar : resolver).mutate(
                    { id: s.id, texto: texto.trim() },
                    { onSuccess: onCerrar },
                  )
                }
              >
                {accion === 'rechazar' ? 'Rechazar' : 'Marcar resuelta'}
              </button>
            </div>
          </div>
        )}

        {error && <MensajeError error={error} />}
        {accion === null && (
          <div className="acciones">
            <button type="button" className="btn" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
