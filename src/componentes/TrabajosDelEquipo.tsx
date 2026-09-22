import { useState } from 'react';
import { useOrdenesTrabajo } from '@/api/ordenesTrabajo';
import { formatearFechaSola, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import {
  ETIQUETA_ESTADO_TRABAJO,
  ETIQUETA_EJECUTOR,
  ETIQUETA_TIPO_TRABAJO,
} from '@/tipos/ordenTrabajo';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import { Cargando, MensajeError } from './Estados';
import { RegistrarTrabajoEquipo } from './RegistrarTrabajoEquipo';

interface Props {
  equipoId: string;
  equipoNombre: string;
  /** Los planes de la máquina, para decir a cuál responde un trabajo. */
  planes?: { id: string; nombre: string }[];
  /** Una máquina dada de baja no recibe trabajos nuevos. */
  permiteNuevos?: boolean;
}

/** Lo que se le hizo a la máquina, sumado. */
function resumir(ordenes: OrdenTrabajo[]) {
  const hechos = ordenes.filter((o) => o.estado !== 'ANULADA');
  return {
    cantidad: hechos.length,
    preventivos: hechos.filter((o) => o.tipo === 'PREVENTIVO').length,
    correctivos: hechos.filter((o) => o.tipo === 'CORRECTIVO').length,
    // Suma solo lo que tiene costo cargado. No se pone en cero lo que falta: un
    // total que mezcla "gratis" con "no lo sabemos" es un número que miente, y
    // con ese número se decide reparar o reemplazar.
    costo: hechos.reduce((s, o) => s + (o.costoManoObra ?? 0), 0),
    horas: hechos.reduce((s, o) => s + (o.horasParada ?? 0), 0),
  };
}

/**
 * El historial de una máquina: qué le pasó, qué se le hizo y con qué material.
 *
 * Es el único historial. Antes había dos —las intervenciones y las órdenes de
 * trabajo— que contestaban la misma pregunta, y para saber cuánto costó
 * mantener algo había que sumar dos listas.
 */
export function TrabajosDelEquipo({
  equipoId,
  equipoNombre,
  planes = [],
  permiteNuevos = true,
}: Props) {
  const puede = usePuede();
  const [registrando, setRegistrando] = useState(false);

  // Sin permiso no se pide. Un hook no se puede llamar condicionalmente, así
  // que la consulta se apaga con `enabled`: si no, esta sección saldría a
  // pedir trabajos igual y se comería un 403 que se ve como un error rojo.
  const habilitado = puede(P.TRABAJOS_VER);
  const { data, isLoading, error } = useOrdenesTrabajo(1, 20, { equipoId }, habilitado);

  if (!habilitado) return null;

  const ordenes = data?.datos ?? [];
  const resumen = resumir(ordenes);

  return (
    <>
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">Historial de trabajos</h3>
        {permiteNuevos && puede(P.TRABAJOS_EDITAR) && (
          <button className="btn btn-chico btn-primario" onClick={() => setRegistrando(true)}>
            + Registrar trabajo
          </button>
        )}
      </div>

      {!permiteNuevos && (
        <p className="texto-suave texto-chico">
          La máquina está dada de baja: no se le registran trabajos nuevos. El historial queda
          como estaba.
        </p>
      )}

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {resumen.cantidad > 0 && (
        <div className="resumen-mantenimiento">
          <span>
            <b>{resumen.cantidad}</b> trabajos
          </span>
          <span>
            <b>{resumen.preventivos}</b> preventivos
          </span>
          <span>
            <b>{resumen.correctivos}</b> correctivos
          </span>
          {resumen.costo > 0 && (
            <span>
              <b>${formatearNumero(resumen.costo)}</b> en mano de obra
            </span>
          )}
          {resumen.horas > 0 && (
            <span>
              <b>{formatearNumero(resumen.horas)}</b> horas parada
            </span>
          )}
        </div>
      )}

      {data && ordenes.length === 0 && (
        <p className="texto-suave texto-chico">
          Todavía no se registró ningún trabajo sobre esta máquina.
        </p>
      )}

      {ordenes.map((o) => (
        <div className="panel" key={o.id}>
          <div className="fila-acciones">
            <strong>{o.numero}</strong>
            <span className="texto-suave">
              {formatearFechaSola(o.fecha)} · {ETIQUETA_TIPO_TRABAJO[o.tipo]} ·{' '}
              {ETIQUETA_ESTADO_TRABAJO[o.estado]}
              {o.ejecutor === 'EXTERNO' && ` · ${ETIQUETA_EJECUTOR.EXTERNO}`}
              {o.proveedorNombre ? `: ${o.proveedorNombre}` : ''}
            </span>
          </div>

          <p>{o.titulo}</p>
          {o.resolucion && (
            <p className="texto-chico">
              <span className="texto-suave">Se hizo: </span>
              {o.resolucion}
            </p>
          )}

          {o.materiales.length > 0 && (
            <p className="texto-suave texto-chico">
              {o.materiales
                .map((m) => `${m.materialNombre} (${formatearNumero(m.cantidad)} ${m.unidad})`)
                .join(' · ')}
            </p>
          )}

          {(o.costoManoObra !== null || o.horasParada !== null) && (
            <p className="texto-suave texto-chico">
              {o.costoManoObra !== null && `Mano de obra $${formatearNumero(o.costoManoObra)}`}
              {o.costoManoObra !== null && o.horasParada !== null && ' · '}
              {o.horasParada !== null && `${formatearNumero(o.horasParada)} horas parada`}
            </p>
          )}
        </div>
      ))}

      {registrando && (
        <RegistrarTrabajoEquipo
          equipoId={equipoId}
          equipoNombre={equipoNombre}
          planes={planes}
          onCerrar={() => setRegistrando(false)}
        />
      )}
    </>
  );
}
