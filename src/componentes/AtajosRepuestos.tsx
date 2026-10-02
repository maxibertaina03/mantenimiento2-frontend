import { useRepuestos } from '@/api/equipos';
import { formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';

/** Un material elegido para un trabajo, como lo guardan los formularios. */
export interface MaterialParaUsar {
  materialId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
}

/**
 * Los repuestos de la máquina como atajos, al cargar lo que se usó en un
 * trabajo: un toque y queda cargado, con la cantidad que lleva la máquina.
 *
 * Es el uso de la lista de repuestos el día de la reparación: no hace falta
 * acordarse del nombre exacto del retén ni buscarlo entre 900 materiales.
 * Los que ya se cargaron no se ofrecen de nuevo, y los que no tienen stock se
 * muestran pero no se pueden usar: saldrían del pañol en negativo.
 */
export function AtajosRepuestos({
  equipoId,
  yaCargados,
  onUsar,
}: {
  equipoId: string | null | undefined;
  yaCargados: string[];
  onUsar: (material: MaterialParaUsar) => void;
}) {
  const puede = usePuede();
  const repuestos = useRepuestos(equipoId ?? '', !!equipoId && puede(P.EQUIPOS_VER));
  const disponibles = (repuestos.data ?? []).filter(
    (r) => r.materialActivo && !yaCargados.includes(r.materialId),
  );

  if (disponibles.length === 0) return null;

  return (
    <div className="atajos-repuestos">
      <span className="texto-suave texto-chico">Repuestos de esta máquina:</span>
      {disponibles.map((r) => {
        const cantidad = r.cantidad ?? 1;
        const sinStock = r.stockActual <= 0;
        return (
          <button
            key={r.id}
            type="button"
            className="atajo-repuesto"
            disabled={sinStock}
            title={
              sinStock
                ? 'No hay en el pañol'
                : `Hay ${formatearNumero(r.stockActual)}${r.unidad ? ` ${r.unidad}` : ''} en el pañol`
            }
            onClick={() =>
              onUsar({ materialId: r.materialId, nombre: r.materialNombre, unidad: r.unidad, cantidad })
            }
          >
            + {r.materialNombre}
            <span className="atajo-repuesto-cantidad">
              {sinStock ? 'sin stock' : `${formatearNumero(cantidad)}${r.unidad ? ` ${r.unidad}` : ''}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
