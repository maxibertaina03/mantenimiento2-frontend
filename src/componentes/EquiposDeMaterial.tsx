import { Link } from 'react-router-dom';
import { useEquiposDeMaterial } from '@/api/equipos';
import { formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_ESTADO_EQUIPO } from '@/tipos/equipo';
import { Cargando, MensajeError } from './Estados';

/**
 * En qué máquinas va este material: «¿para qué tenemos este retén?».
 *
 * Es la otra punta de los repuestos de cada equipo. Sirve para decidir el
 * mínimo de stock (va en cinco bombas) y para saber a quién afecta que falte.
 */
export function EquiposDeMaterial({ materialId, unidad }: { materialId: string; unidad: string }) {
  const puede = usePuede();
  const habilitado = puede(P.EQUIPOS_VER);
  const equipos = useEquiposDeMaterial(materialId, habilitado);

  if (!habilitado) return null;
  const lista = equipos.data ?? [];

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>
        Equipos que lo llevan{lista.length > 0 ? ` (${lista.length})` : ''}
      </h2>
      {equipos.isLoading && <Cargando />}
      {equipos.error && <MensajeError error={equipos.error} />}
      {equipos.data && lista.length === 0 && (
        <p className="texto-suave" style={{ margin: 0 }}>
          Todavía no está cargado como repuesto de ninguna máquina. Se agrega desde la ficha del
          equipo, en «Repuestos».
        </p>
      )}
      {lista.length > 0 && (
        <ul className="equipos-de-material">
          {lista.map((e) => (
            <li key={e.repuestoId}>
              <Link to={`/equipos/${e.equipoId}`} className="equipo-de-material">
                {e.fotoUrl ? (
                  <img src={e.fotoUrl} alt="" className="combo-foto" loading="lazy" />
                ) : (
                  <span className="combo-foto combo-foto-vacia" aria-hidden="true" />
                )}
                <span>
                  <strong>{e.equipoNombre}</strong>
                  <span className="texto-suave texto-chico" style={{ display: 'block' }}>
                    {[
                      e.ubicacionNombre,
                      e.cantidad !== null
                        ? `lleva ${formatearNumero(e.cantidad)}${unidad ? ` ${unidad}` : ''}`
                        : null,
                      e.notas,
                      e.equipoEstado !== 'OPERATIVO' ? ETIQUETA_ESTADO_EQUIPO[e.equipoEstado] : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
