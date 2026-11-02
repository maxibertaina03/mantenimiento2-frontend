import { useInformeCompras } from '@/api/informes';
import { Cargando, EstadoVacio, MensajeError } from '../Estados';
import { moneda } from '../ordenesCompra/formato';
import type { PeriodoInforme } from '@/tipos/informe';
import { COLOR, montoCorto, montoEntero } from '@/lib/formatoInforme';
import { GraficoSerie } from './GraficoSerie';
import { Barrita, Bloque, Kpi, Kpis } from './piezas';

const dias = (d: number | null) =>
  d === null ? '—' : `${d.toLocaleString('es-AR', { maximumFractionDigits: 1 })} días`;

/** Las órdenes de compra: cuántas, cuánta plata, a quién y cuánto tardan en llegar. */
export function PestanaCompras({ periodo }: { periodo: PeriodoInforme }) {
  const { data, isLoading, error } = useInformeCompras(periodo);
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data) return null;

  const r = data.resumen;
  const maximo = Math.max(0, ...data.proveedores.map((p) => p.monto));

  return (
    <>
      <Kpis>
        <Kpi
          etiqueta="Órdenes de compra"
          valor={r.ordenes}
          detalle={`emitidas · ${r.borradores} en borrador · ${r.anuladas} anuladas`}
        />
        <Kpi
          etiqueta="Comprado"
          valor={montoEntero(r.monto)}
          tono="verde"
          detalle={
            r.sinPrecio > 0
              ? `${r.sinPrecio} ${r.sinPrecio === 1 ? 'orden sin precio, no sumada' : 'órdenes sin precio, no sumadas'}`
              : 'todas con precio'
          }
        />
        <Kpi etiqueta="Recibidas" valor={r.recibidas} tono="violeta" detalle="en el período" />
        <Kpi
          etiqueta="Entrega"
          valor={dias(r.diasDeEntrega)}
          tono="ambar"
          detalle="de emitida a recibida, en promedio"
        />
        <Kpi
          etiqueta="Con faltante"
          valor={r.conFaltante}
          tono={r.conFaltante > 0 ? 'rojo' : 'gris'}
          detalle="se cerraron sin llegar todo"
        />
      </Kpis>

      <div className="grilla-informe">
        <Bloque titulo="Órdenes por período" ayuda="Cuentan el día en que se emitieron.">
          <GraficoSerie
            datos={data.serie}
            agrupar={periodo.agrupar}
            series={[{ clave: 'ordenes', nombre: 'Órdenes', color: COLOR.azul }]}
          />
        </Bloque>
        <Bloque
          titulo="Plata comprada"
          ayuda="En pesos, de las órdenes con todos los precios cargados."
        >
          <GraficoSerie
            datos={data.serie}
            agrupar={periodo.agrupar}
            series={[{ clave: 'monto', nombre: 'Comprado', color: COLOR.verde }]}
            formatoValor={montoCorto}
            anchoEje={72}
          />
        </Bloque>
      </div>

      <Bloque titulo="Proveedores" ayuda="A quién se le compró más en el período.">
        {data.proveedores.length === 0 ? (
          <EstadoVacio>No hubo órdenes de compra en el período.</EstadoVacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla tabla-informe">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th className="numero">Órdenes</th>
                  <th>Comprado</th>
                  <th className="numero">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {data.proveedores.map((p) => (
                  <tr key={p.proveedor}>
                    <td>{p.proveedor}</td>
                    <td className="numero">{p.ordenes}</td>
                    <td>
                      <Barrita
                        valor={p.monto}
                        maximo={maximo}
                        tono="verde"
                        texto={moneda(p.monto)}
                      />
                    </td>
                    <td className="numero">{dias(p.diasDeEntrega)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloque>
    </>
  );
}
