import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTareaDelPlan } from '@/api/calendario';
import { usePlanesQueVencen } from '@/api/equipos';
import { useUsuarioActual } from '@/api/usuarios';
import { CompletarTarea } from '@/componentes/CompletarTarea';
import { P, usePuede } from '@/lib/permisos';
import type { Tarea } from '@/tipos/tarea';
import { textoVencimiento } from '@/componentes/PlanesEquipo';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFechaSola } from '@/lib/formato';
import { ETIQUETA_ESTADO_PLAN } from '@/tipos/equipo';

/** Ventanas de tiempo para mirar hacia adelante. */
const HORIZONTES = [
  { dias: 7, texto: 'Esta semana' },
  { dias: 15, texto: '15 días' },
  { dias: 30, texto: 'Un mes' },
  { dias: 90, texto: 'Tres meses' },
];

/**
 * Los servicios que vencen, de lo más urgente a lo menos.
 *
 * Es la pantalla del día a día: contesta "¿qué hay que hacer?" sin que nadie
 * tenga que recorrer 326 fichas. Incluye lo ya vencido, porque si nadie lo hizo
 * es justamente lo que más urge.
 */
export function ServiciosPage() {
  const [dias, setDias] = useState(7);
  const { data, isLoading, error, isFetching } = usePlanesQueVencen(dias);
  const navegar = useNavigate();
  const puede = usePuede();
  const puedeHacerlos = puede(P.TAREAS_EDITAR);
  const { data: yo } = useUsuarioActual();
  const traerTarea = useTareaDelPlan();
  const [completando, setCompletando] = useState<Tarea | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * Dar un service por hecho es completar su tarea del calendario: así queda
   * hecha allá también, con su orden de trabajo, y el plan corre a la próxima
   * fecha. No hay un camino aparte que pueda contar otra cosa.
   */
  const darPorHecho = async (planId: string) => {
    setAviso(null);
    const tarea = await traerTarea.mutateAsync(planId);
    if (tarea.asignadoAId !== null && tarea.asignadoAId !== yo?.id) {
      setAviso(
        `«${tarea.titulo}» está asignado a ${tarea.asignadoANombre ?? 'otra persona'}: lo da por hecho esa persona.`,
      );
      return;
    }
    setCompletando(tarea);
  };

  const vencidos = (data ?? []).filter((p) => p.estado === 'VENCIDO').length;

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Servicios que vencen</h1>
      </div>

      <div className="buscador">
        {HORIZONTES.map((h) => (
          <button
            key={h.dias}
            className={dias === h.dias ? 'btn btn-primario' : 'btn'}
            onClick={() => setDias(h.dias)}
          >
            {h.texto}
          </button>
        ))}
        {isFetching && <span className="texto-suave">actualizando…</span>}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {traerTarea.error && <MensajeError error={traerTarea.error} />}
      {aviso && <p className="aviso-escaneo es-error">{aviso}</p>}

      {data && data.length > 0 && (
        <div className="resumen-mantenimiento">
          <span>
            <b>{data.length}</b> servicios en esta ventana
          </span>
          {vencidos > 0 && (
            <span>
              <b>{vencidos}</b> ya vencidos
            </span>
          )}
        </div>
      )}

      {data && data.length === 0 && (
        <EstadoVacio>
          No hay servicios que venzan en este plazo. Si no esperabas eso, puede que todavía no
          haya planes definidos: se cargan desde la ficha de cada equipo.
        </EstadoVacio>
      )}

      {data && data.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Trabajo</th>
                <th>Sector</th>
                <th>Vence</th>
                <th>Estado</th>
                {puedeHacerlos && <th />}
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navegar(`/equipos/${p.equipoId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td data-etiqueta="Equipo">
                    <strong>{p.equipoNombre}</strong>
                  </td>
                  <td data-etiqueta="Trabajo">{p.nombre}</td>
                  <td data-etiqueta="Sector">{p.ubicacionNombre ?? '—'}</td>
                  <td data-etiqueta="Vence">
                    {formatearFechaSola(p.proximaFecha)}
                    <div className="texto-suave texto-chico">
                      {textoVencimiento(p.diasParaVencer)}
                    </div>
                  </td>
                  <td data-etiqueta="Estado">
                    <span className={`etiqueta plan-etq-${p.estado.toLowerCase()}`}>
                      {ETIQUETA_ESTADO_PLAN[p.estado]}
                    </span>
                  </td>
                  {puedeHacerlos && (
                    <td className="celda-acciones">
                      <button
                        type="button"
                        className="btn btn-sm btn-primario"
                        disabled={traerTarea.isPending}
                        onClick={(e) => {
                          // La fila abre la ficha del equipo; el botón no.
                          e.stopPropagation();
                          void darPorHecho(p.id);
                        }}
                      >
                        Dar por hecho
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {completando && (
        <CompletarTarea tarea={completando} onCerrar={() => setCompletando(null)} />
      )}

      <p className="texto-suave texto-chico">
        No aparecen los equipos fuera de servicio ni dados de baja: no tiene sentido pedir un
        service para algo que está desafectado.
      </p>

      {/* APAGADO (2026-09-30): el correo diario está desactivado a pedido. Si se
          vuelve a prender el aviso, volver a mostrar este texto.
      <p className="texto-suave texto-chico">
        Todos los días sale un correo con lo que vence dentro de la semana y con lo que ya
        venció. No se repite mientras no haya nada nuevo: un mismo aviso todas las mañanas
        termina en una regla de bandeja que lo archiva sin leer.
      </p>
      */}
    </>
  );
}
