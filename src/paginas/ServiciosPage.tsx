import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanesQueVencen } from '@/api/equipos';
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
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navegar(`/equipos?equipo=${p.equipoId}`)}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="texto-suave texto-chico">
        No aparecen los equipos fuera de servicio ni dados de baja: no tiene sentido pedir un
        service para algo que está desafectado.
      </p>
    </>
  );
}
