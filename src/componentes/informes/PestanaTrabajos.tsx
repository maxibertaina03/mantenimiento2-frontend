import { useInformeTrabajos } from '@/api/informes';
import { Cargando, EstadoVacio, MensajeError } from '../Estados';
import type { PeriodoInforme, RankingTrabajos } from '@/tipos/informe';
import { GraficoSerie } from './GraficoSerie';
import { COLOR, textoHoras, textoPorcentaje } from '@/lib/formatoInforme';
import { Barrita, Bloque, Kpi, Kpis } from './piezas';

/** Las órdenes de trabajo del período: cuántas, de qué tipo, cuánto tardan y dónde. */
export function PestanaTrabajos({ periodo }: { periodo: PeriodoInforme }) {
  const { data, isLoading, error } = useInformeTrabajos(periodo);
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data) return null;

  const r = data.resumen;
  const preventivo = r.abiertas > 0 ? Math.round((r.preventivas / r.abiertas) * 100) : null;

  return (
    <>
      <Kpis>
        <Kpi
          etiqueta="Órdenes abiertas"
          valor={r.abiertas}
          detalle={`${r.siguenAbiertas} siguen abiertas · ${r.anuladas} anuladas`}
        />
        <Kpi etiqueta="Cerradas" valor={r.cerradas} tono="verde" detalle="en el período" />
        <Kpi
          etiqueta="Preventivo"
          valor={textoPorcentaje(preventivo)}
          tono={preventivo !== null && preventivo < 50 ? 'ambar' : 'verde'}
          detalle={`${r.preventivas} preventivas · ${r.correctivas} correctivas · ${r.mejoras} mejoras`}
        />
        <Kpi
          etiqueta="Horas de parada"
          valor={r.horasParada.toLocaleString('es-AR')}
          tono={r.horasParada > 0 ? 'rojo' : 'gris'}
          detalle="de las órdenes cerradas"
        />
        <Kpi
          etiqueta="De abrir a cerrar"
          valor={textoHoras(r.horasHastaCerrar)}
          tono="violeta"
          detalle={`promedio de las que quedaron abiertas · ${r.externas} con taller de afuera`}
        />
      </Kpis>

      <Bloque
        titulo="Órdenes por período"
        ayuda="Las barras son las órdenes que se abrieron, por tipo; la línea, las que se cerraron."
      >
        <GraficoSerie
          datos={data.serie}
          agrupar={periodo.agrupar}
          series={[
            { clave: 'PREVENTIVO', nombre: 'Preventivas', color: COLOR.verde, pila: 'tipo' },
            { clave: 'CORRECTIVO', nombre: 'Correctivas', color: COLOR.rojo, pila: 'tipo' },
            { clave: 'MEJORA', nombre: 'Mejoras', color: COLOR.violeta, pila: 'tipo' },
            { clave: 'cerradas', nombre: 'Cerradas', color: COLOR.azul, linea: true },
          ]}
        />
      </Bloque>

      <div className="grilla-informe">
        <Bloque titulo="Equipos con más órdenes" ayuda="Los que más trabajo pidieron en el período.">
          <TablaRanking filas={data.equipos} titulo="Equipo" />
        </Bloque>
        <Bloque titulo="Sectores con más órdenes">
          <TablaRanking filas={data.sectores} titulo="Sector" />
        </Bloque>
      </div>
    </>
  );
}

function TablaRanking({ filas, titulo }: { filas: RankingTrabajos[]; titulo: string }) {
  if (filas.length === 0) return <EstadoVacio>No hubo órdenes en el período.</EstadoVacio>;
  const maximo = Math.max(...filas.map((f) => f.ordenes));
  return (
    <div className="tabla-scroll">
      <table className="tabla tabla-informe">
        <thead>
          <tr>
            <th>{titulo}</th>
            <th>Órdenes</th>
            <th className="numero">Correctivas</th>
            <th className="numero">Horas parada</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <td>{f.nombre}</td>
              <td>
                <Barrita valor={f.ordenes} maximo={maximo} />
              </td>
              <td className="numero">{f.correctivas}</td>
              <td className="numero">{f.horasParada.toLocaleString('es-AR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
