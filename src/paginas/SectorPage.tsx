import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrdenesTrabajo } from '@/api/ordenesTrabajo';
import { useSector } from '@/api/sectores';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { RegistrarTrabajoEquipo } from '@/componentes/RegistrarTrabajoEquipo';
import { ModalDetalleOrden } from '@/componentes/ordenesTrabajo/ModalDetalleOrden';
import { formatearFechaSola, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { ETIQUETA_ESTADO_EQUIPO, type EstadoEquipo } from '@/tipos/equipo';
import {
  ETIQUETA_ESTADO_TRABAJO,
  ETIQUETA_TIPO_TRABAJO,
  type OrdenTrabajo,
} from '@/tipos/ordenTrabajo';
import type { TotalesDeTrabajos } from '@/tipos/sector';

type Pestana = 'sector' | 'maquinas-trabajos' | 'maquinas';

/**
 * Un sector: lo que se hizo sobre él, lo que se les hizo a sus máquinas y
 * cuáles son.
 *
 * Los trabajos del sector y los de sus máquinas van en pestañas y totales
 * separados a propósito: si una rotura del sector frena también a sus
 * máquinas, sumarlos contaría dos veces la misma parada.
 */
export function SectorPage() {
  const { id = '' } = useParams();
  const puede = usePuede();
  const { data: sector, isLoading, error } = useSector(id);
  const [pestana, setPestana] = useState<Pestana>('sector');
  const [registrando, setRegistrando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!sector) return null;

  const pestanas: { id: Pestana; titulo: string; n: number }[] = [
    { id: 'sector', titulo: 'Trabajos del sector', n: sector.delSector.trabajos },
    {
      id: 'maquinas-trabajos',
      titulo: 'Trabajos en sus máquinas',
      n: sector.deSusMaquinas.trabajos,
    },
    { id: 'maquinas', titulo: 'Máquinas', n: sector.maquinas.length },
  ];

  return (
    <div className="pagina">
      <Link to="/sectores" className="texto-suave volver">
        <ArrowLeft className="icono" aria-hidden />
        Sectores
      </Link>

      <div className="cabecera-pagina">
        <div>
          <h1>{sector.nombre}</h1>
          <p className="texto-suave">
            {sector.maquinas.length === 1
              ? '1 máquina en el sector'
              : `${sector.maquinas.length} máquinas en el sector`}
          </p>
        </div>
        {puede(P.TRABAJOS_EDITAR) && (
          <div className="fila-acciones">
            <button className="btn btn-primario" onClick={() => setRegistrando(true)}>
              <Plus className="icono" aria-hidden />
              Registrar trabajo
            </button>
          </div>
        )}
      </div>

      <div className="totales-sector">
        <Totales titulo="Del sector" totales={sector.delSector} />
        <Totales titulo="De sus máquinas" totales={sector.deSusMaquinas} />
      </div>

      <div className="pestanas-equipo" role="tablist" aria-label="Qué mostrar">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={pestana === p.id ? 'pestana-equipo activa' : 'pestana-equipo'}
            onClick={() => setPestana(p.id)}
          >
            {p.titulo}
            {p.n > 0 && <span className="contador-pestana">{p.n}</span>}
          </button>
        ))}
      </div>

      {pestana === 'sector' && (
        <ListaDeTrabajos ubicacionId={sector.id} deSusMaquinas={false} onAbrir={setAbierta} />
      )}
      {pestana === 'maquinas-trabajos' && (
        <ListaDeTrabajos ubicacionId={sector.id} deSusMaquinas onAbrir={setAbierta} />
      )}
      {pestana === 'maquinas' &&
        (sector.maquinas.length === 0 ? (
          <p className="texto-suave">No hay máquinas cargadas en este sector.</p>
        ) : (
          <ul className="panel panel-lista lista-maquinas-sector">
            {sector.maquinas.map((m) => (
              <li key={m.id}>
                <Link to={`/equipos/${m.id}`}>
                  <strong>{m.nombre}</strong>
                </Link>
                <span className="texto-suave texto-chico">
                  {m.codigo ? `${m.codigo} · ` : ''}
                  {ETIQUETA_ESTADO_EQUIPO[m.estado as EstadoEquipo] ?? m.estado}
                </span>
              </li>
            ))}
          </ul>
        ))}

      {registrando && (
        <RegistrarTrabajoEquipo
          ubicacionId={sector.id}
          equipoNombre={sector.nombre}
          onCerrar={() => setRegistrando(false)}
        />
      )}
      {abierta && <ModalDetalleOrden id={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}

function Totales({ titulo, totales }: { titulo: string; totales: TotalesDeTrabajos }) {
  return (
    <div className="panel totales-sector-bloque">
      <span className="texto-suave texto-chico">{titulo}</span>
      <span>
        <b>{totales.trabajos}</b> {totales.trabajos === 1 ? 'trabajo' : 'trabajos'}
      </span>
      <span>
        <b>{formatearNumero(totales.horasParada)}</b> h de parada
      </span>
      {totales.costoManoObra > 0 && (
        <span>
          <b>${formatearNumero(totales.costoManoObra)}</b> en mano de obra
        </span>
      )}
    </div>
  );
}

/** Los trabajos del sector, o los de sus máquinas, el más reciente primero. */
function ListaDeTrabajos({
  ubicacionId,
  deSusMaquinas,
  onAbrir,
}: {
  ubicacionId: string;
  deSusMaquinas: boolean;
  onAbrir: (id: string) => void;
}) {
  const { data, isLoading, error } = useOrdenesTrabajo(1, 50, { ubicacionId, deSusMaquinas });
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  const ordenes = data?.datos ?? [];
  if (ordenes.length === 0) {
    return (
      <p className="texto-suave">
        {deSusMaquinas
          ? 'Todavía no se registró ningún trabajo en las máquinas de este sector.'
          : 'Todavía no se registró ningún trabajo sobre este sector.'}
      </p>
    );
  }
  return (
    <ul className="lista-trabajos-sector">
      {ordenes.map((o) => (
        <li key={o.id}>
          <button type="button" className="panel trabajo-sector" onClick={() => onAbrir(o.id)}>
            <span className="fila-acciones">
              <strong>{o.numero}</strong>
              <span className="texto-suave texto-chico">
                {formatearFechaSola(o.fecha)} · {ETIQUETA_TIPO_TRABAJO[o.tipo]} ·{' '}
                {ETIQUETA_ESTADO_TRABAJO[o.estado]}
              </span>
            </span>
            <span>
              {deSusMaquinas && o.equipoNombre && (
                <span className="etiqueta" style={{ marginRight: '0.4rem' }}>
                  {o.equipoNombre}
                </span>
              )}
              {o.titulo}
            </span>
            <DatosDelTrabajo orden={o} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function DatosDelTrabajo({ orden: o }: { orden: OrdenTrabajo }) {
  const partes = [
    o.asignadoANombre ? `Lo hizo ${o.asignadoANombre}` : null,
    o.proveedorNombre ? `Taller: ${o.proveedorNombre}` : null,
    o.horasParada !== null ? `${formatearNumero(o.horasParada)} h de parada` : null,
    o.materiales.length > 0
      ? o.materiales
          .map((m) => `${m.materialNombre} (${formatearNumero(m.cantidad)} ${m.unidad})`)
          .join(', ')
      : null,
  ].filter(Boolean);
  if (partes.length === 0) return null;
  return <span className="texto-suave texto-chico">{partes.join(' · ')}</span>;
}
