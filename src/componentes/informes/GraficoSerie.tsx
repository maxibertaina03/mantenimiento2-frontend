import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { etiquetaTramo } from '@/lib/periodoInforme';
import type { Agrupar } from '@/tipos/informe';

export interface SerieGrafico {
  clave: string;
  nombre: string;
  color: string;
  /** Barras con la misma pila van una encima de otra. */
  pila?: string;
  /** Línea en vez de barra: para comparar contra las barras. */
  linea?: boolean;
}

/**
 * Un gráfico por período: barras (apiladas o no) y, si hace falta, una línea.
 *
 * Recibe los tramos ya completos (el servidor manda también los vacíos), así
 * que una semana sin nada se ve como un hueco y no desaparece.
 */
export function GraficoSerie<T extends { tramo: string }>({
  datos,
  series,
  agrupar,
  alto = 260,
  formatoValor = (v: number) => v.toLocaleString('es-AR'),
  anchoEje = 40,
}: {
  datos: T[];
  series: SerieGrafico[];
  agrupar: Agrupar;
  alto?: number;
  formatoValor?: (v: number) => string;
  /** Más ancho cuando el eje lleva plata. */
  anchoEje?: number;
}) {
  return (
    <div className="grafico-informe" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="tramo"
            tickFormatter={(t: string) => etiquetaTramo(t, agrupar)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            minTickGap={8}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={anchoEje}
            tickFormatter={formatoValor}
          />
          <Tooltip
            labelFormatter={(t) => etiquetaTramo(String(t), agrupar)}
            formatter={(v) => formatoValor(Number(v))}
            cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {series.map((s) =>
            s.linea ? (
              <Line
                key={s.clave}
                dataKey={s.clave}
                name={s.nombre}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                isAnimationActive={false}
              />
            ) : (
              <Bar
                key={s.clave}
                dataKey={s.clave}
                name={s.nombre}
                fill={s.color}
                stackId={s.pila}
                maxBarSize={42}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
