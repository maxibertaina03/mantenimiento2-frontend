import { Camera, Plus } from 'lucide-react';
import { useState } from 'react';
import { useOpcionesSolicitud, useSolicitudes } from '@/api/solicitudes';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { DetalleSolicitud } from '@/componentes/solicitudes/DetalleSolicitud';
import { NuevaSolicitud } from '@/componentes/solicitudes/NuevaSolicitud';
import { formatearFecha } from '@/lib/formato';
import { useListaEnUrl, type EsquemaFiltros } from '@/lib/listaEnUrl';
import { P, usePermisosListos, usePuede } from '@/lib/permisos';
import {
  CLASE_ESTADO_SOLICITUD,
  ESTADOS_SOLICITUD,
  ETIQUETA_ESTADO_SOLICITUD,
  type EstadoSolicitud,
  type Solicitud,
  type Urgencia,
} from '@/tipos/solicitud';

interface Filtros {
  estado?: string;
  sectorId?: string;
  urgentes?: boolean;
}

/** Los filtros van en plural: «Nuevas», no «Nueva». */
const FILTRO_ESTADO: Record<EstadoSolicitud, string> = {
  NUEVA: 'Nuevas',
  EN_CURSO: 'En curso',
  RESUELTA: 'Resueltas',
  RECHAZADA: 'Rechazadas',
};

const ESQUEMA: EsquemaFiltros<Filtros> = { estado: 'texto', sectorId: 'texto', urgentes: 'si' };

/**
 * Las solicitudes de trabajo: lo que cada sector le avisa a mantenimiento.
 *
 * Un sector ve las suyas y carga nuevas; mantenimiento ve las de todos, las
 * nuevas primero y las urgentes arriba, y desde el detalle genera la orden de
 * trabajo, la resuelve o la rechaza. La lista se refresca sola cada 30 s.
 */
export function SolicitudesPage() {
  const puede = usePuede();
  const listos = usePermisosListos();
  const veTodas = puede(P.SOLICITUDES_VER);
  const carga = puede(P.SOLICITUDES_CREAR);
  const { filtros, cambiarFiltros } = useListaEnUrl<Filtros>(ESQUEMA);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<Solicitud | null>(null);
  const [recienCreada, setRecienCreada] = useState<string | null>(null);

  const estado = ESTADOS_SOLICITUD.includes(filtros.estado as EstadoSolicitud)
    ? (filtros.estado as EstadoSolicitud)
    : undefined;
  const { data, isLoading, error } = useSolicitudes(
    {
      estado,
      sectorId: filtros.sectorId || undefined,
      urgencia: filtros.urgentes ? ('URGENTE' as Urgencia) : undefined,
    },
    veTodas || carga,
  );
  const { data: opciones } = useOpcionesSolicitud(veTodas && carga);

  // Hasta saber qué puede, no se sabe si es «Mis solicitudes» o las de todos.
  if (!listos) return <Cargando />;
  if (!veTodas && !carga) {
    return <EstadoVacio>Tu rol no tiene acceso a las solicitudes de trabajo.</EstadoVacio>;
  }

  return (
    <div className="pagina">
      <div className="cabecera-pagina">
        <div>
          <h1>{veTodas ? 'Solicitudes de trabajo' : 'Mis solicitudes'}</h1>
          <p className="texto-suave">
            {veTodas
              ? 'Lo que los sectores le avisan a mantenimiento. Las nuevas primero, las urgentes arriba.'
              : 'Avisale a mantenimiento lo que pasa en tu sector y seguí qué se hizo.'}
          </p>
        </div>
        {carga && (
          <button className="btn btn-primario btn-grande" onClick={() => setCargando(true)}>
            <Plus className="icono" aria-hidden />
            Nueva solicitud
          </button>
        )}
      </div>

      {recienCreada && (
        <div className="alerta alerta-exito">
          Listo: la solicitud {recienCreada} le llegó a mantenimiento. Acá vas a ver qué se hizo.
        </div>
      )}

      <div className="atajos-filtro" role="group" aria-label="Estado">
        {[undefined, ...ESTADOS_SOLICITUD].map((e) => (
          <button
            key={e ?? 'todas'}
            type="button"
            className={`chip-periodo${estado === e ? ' activo' : ''}`}
            aria-pressed={estado === e}
            onClick={() => cambiarFiltros({ estado: e })}
          >
            {e ? FILTRO_ESTADO[e] : 'Todas'}
          </button>
        ))}
        {veTodas && (
          <button
            type="button"
            className={`chip-periodo${filtros.urgentes ? ' activo' : ''}`}
            aria-pressed={Boolean(filtros.urgentes)}
            onClick={() => cambiarFiltros({ urgentes: !filtros.urgentes || undefined })}
          >
            Solo urgentes
          </button>
        )}
        {veTodas && opciones && (
          <select
            aria-label="Sector"
            value={filtros.sectorId ?? ''}
            onChange={(ev) => cambiarFiltros({ sectorId: ev.target.value || undefined })}
          >
            <option value="">Todos los sectores</option>
            {opciones.sectores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {data && data.length === 0 && (
        <EstadoVacio>
          {veTodas
            ? 'No hay solicitudes con estos filtros.'
            : 'Todavía no cargaste ninguna. Cuando algo ande mal en tu sector, tocá «Nueva solicitud».'}
        </EstadoVacio>
      )}

      {data && data.length > 0 && (
        <ul className="lista-solicitudes">
          {data.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`tarjeta-solicitud${s.urgencia === 'URGENTE' && s.estado === 'NUEVA' ? ' urgente' : ''}`}
                onClick={() => setAbierta(s)}
              >
                <span className="tarjeta-solicitud-cabecera">
                  <strong>{s.numero}</strong>
                  <span className={CLASE_ESTADO_SOLICITUD[s.estado]}>
                    {ETIQUETA_ESTADO_SOLICITUD[s.estado]}
                  </span>
                  {s.urgencia === 'URGENTE' && <span className="badge badge-error">Urgente</span>}
                  {s.fotos.length > 0 && (
                    <span className="texto-suave texto-chico con-icono">
                      <Camera className="icono" aria-hidden />
                      {s.fotos.length}
                    </span>
                  )}
                </span>
                <span className="tarjeta-solicitud-texto">{s.descripcion}</span>
                <span className="texto-suave texto-chico">
                  {s.sectorNombre}
                  {s.equipoNombre && ` · ${s.equipoNombre}`} · {formatearFecha(s.creadoEn)}
                  {veTodas && s.solicitadaPorNombre && ` · ${s.solicitadaPorNombre}`}
                  {s.ordenTrabajoNumero && ` · ${s.ordenTrabajoNumero}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {cargando && (
        <NuevaSolicitud
          onCerrar={() => setCargando(false)}
          onCreada={(s) => {
            setCargando(false);
            setRecienCreada(s.numero);
          }}
        />
      )}
      {abierta && (
        <DetalleSolicitud
          // La de la lista puede quedar vieja: se busca la actual por id.
          solicitud={data?.find((s) => s.id === abierta.id) ?? abierta}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}
