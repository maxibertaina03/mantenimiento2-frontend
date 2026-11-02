import { Link } from 'react-router-dom';
import { useInformePanol } from '@/api/informes';
import { formatearFechaSola, formatearNumero } from '@/lib/formato';
import { Cargando, EstadoVacio, MensajeError } from '../Estados';
import type { PeriodoInforme } from '@/tipos/informe';
import { GraficoSerie } from './GraficoSerie';
import { COLOR } from '@/lib/formatoInforme';
import { Barrita, Bloque, Kpi, Kpis } from './piezas';

const MOTIVOS: Record<string, string> = {
  COMPRA: 'Compra',
  TRABAJO: 'Trabajo',
  AJUSTE: 'Ajuste',
  DEVOLUCION: 'Devolución',
  OTRO: 'Otro',
};

/** El pañol: qué entra, qué sale, qué se usa más y qué no se mueve. */
export function PestanaPanol({ periodo }: { periodo: PeriodoInforme }) {
  const { data, isLoading, error } = useInformePanol(periodo);
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data) return null;

  const r = data.resumen;
  const maximoUsado = Math.max(0, ...data.masUsados.map((m) => m.veces));

  return (
    <>
      <Kpis>
        <Kpi etiqueta="Entradas" valor={r.entradas} tono="verde" detalle="movimientos" />
        <Kpi etiqueta="Salidas" valor={r.salidas} tono="rojo" detalle="movimientos" />
        <Kpi etiqueta="Ajustes" valor={r.ajustes} tono="violeta" detalle="correcciones de stock" />
        <Kpi
          etiqueta="Sin moverse"
          valor={r.quietos}
          tono={r.quietos > 0 ? 'ambar' : 'gris'}
          detalle={`materiales con stock, ${data.diasQuieto} días quietos`}
        />
      </Kpis>

      <Bloque titulo="Movimientos por período">
        <GraficoSerie
          datos={data.serie}
          agrupar={periodo.agrupar}
          series={[
            { clave: 'entradas', nombre: 'Entradas', color: COLOR.verde },
            { clave: 'salidas', nombre: 'Salidas', color: COLOR.rojo },
            { clave: 'ajustes', nombre: 'Ajustes', color: COLOR.violeta },
          ]}
        />
        {data.porMotivo.length > 0 && (
          <p className="texto-suave texto-chico">
            Por motivo:{' '}
            {data.porMotivo
              .map((m) => `${MOTIVOS[m.motivo] ?? m.motivo} ${m.movimientos}`)
              .join(' · ')}
          </p>
        )}
      </Bloque>

      <div className="grilla-informe">
        <Bloque titulo="Lo que más salió" ayuda="Por cantidad que salió del pañol.">
          {data.masUsados.length === 0 ? (
            <EstadoVacio>No salió nada en el período.</EstadoVacio>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla tabla-informe">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="numero">Cantidad</th>
                    <th>Veces</th>
                  </tr>
                </thead>
                <tbody>
                  {data.masUsados.map((m) => (
                    <tr key={m.materialId}>
                      <td>
                        <Link to={`/materiales/${m.materialId}`}>{m.material}</Link>
                      </td>
                      <td className="numero">
                        {formatearNumero(m.cantidad)} {m.unidad}
                      </td>
                      <td>
                        <Barrita valor={m.veces} maximo={maximoUsado} tono="rojo" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloque>

        <Bloque
          titulo="No se mueven"
          ayuda={`Tienen stock y no tuvieron ningún movimiento en ${data.diasQuieto} días. Los más quietos primero.`}
        >
          {data.quietos.length === 0 ? (
            <EstadoVacio>Todo lo que hay en stock se movió.</EstadoVacio>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla tabla-informe">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="numero">Stock</th>
                    <th className="numero">Último movimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quietos.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link to={`/materiales/${m.id}`}>{m.nombre}</Link>
                      </td>
                      <td className="numero">
                        {formatearNumero(m.stockActual)} {m.unidad}
                      </td>
                      <td className="numero">
                        {m.ultimoMovimiento ? formatearFechaSola(m.ultimoMovimiento) : 'nunca'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloque>
      </div>
    </>
  );
}
