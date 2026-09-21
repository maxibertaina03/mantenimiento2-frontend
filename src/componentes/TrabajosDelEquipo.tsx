import { useOrdenesTrabajo } from '@/api/ordenesTrabajo';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_ESTADO_TRABAJO, ETIQUETA_TIPO_TRABAJO } from '@/tipos/ordenTrabajo';
import { Cargando, MensajeError } from './Estados';

/**
 * Las órdenes de trabajo que nombraron a este equipo, en su ficha.
 *
 * Es el pago de haber relacionado las dos cosas: acá se lee de corrido qué le
 * pasó a la máquina, qué se le hizo y con qué material, sin salir de la ficha.
 * El historial de intervenciones que está más arriba sigue existiendo aparte:
 * ese es para los service de terceros, que no consumen nada del pañol.
 */
export function TrabajosDelEquipo({ equipoId }: { equipoId: string }) {
  const puede = usePuede();
  // Sin permiso no se pide. Un hook no se puede llamar condicionalmente, así
  // que la consulta se apaga con `enabled`: si no, esta sección saldría a
  // pedir trabajos igual y se comería un 403 que se ve como un error rojo.
  const habilitado = puede(P.TRABAJOS_VER);
  const { data, isLoading, error } = useOrdenesTrabajo(1, 20, { equipoId }, habilitado);

  if (!habilitado) return null;

  const ordenes = data?.datos ?? [];

  return (
    <>
      <h3 className="subtitulo-form">Órdenes de trabajo</h3>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && ordenes.length === 0 && (
        <p className="texto-suave texto-chico">
          Ninguna orden de trabajo nombra a este equipo todavía.
        </p>
      )}

      {ordenes.map((o) => (
        <div className="panel" key={o.id}>
          <div className="fila-acciones">
            <strong>{o.numero}</strong>
            <span className="texto-suave">
              {ETIQUETA_TIPO_TRABAJO[o.tipo]} · {ETIQUETA_ESTADO_TRABAJO[o.estado]} ·{' '}
              {formatearFecha(o.abiertaEn)}
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
        </div>
      ))}
    </>
  );
}
