import type { ReactNode } from 'react';
import { LogoLasTres } from '../LogoLasTres';
import { COLOR, type Tono } from '@/lib/formatoInforme';
import { textoPeriodo } from '@/lib/periodoInforme';
import type { PeriodoInforme } from '@/tipos/informe';

/** Una tarjeta de número: la etiqueta chica arriba, el número grande y una aclaración. */
export function Kpi({
  etiqueta,
  valor,
  detalle,
  tono = 'azul',
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: Tono;
}) {
  return (
    <div className={`kpi-informe kpi-${tono}`}>
      <span className="kpi-informe-etiqueta">{etiqueta}</span>
      <span
        className="kpi-informe-valor"
        title={typeof valor === 'string' || typeof valor === 'number' ? String(valor) : undefined}
      >
        {valor}
      </span>
      {detalle && <span className="kpi-informe-detalle">{detalle}</span>}
    </div>
  );
}

export function Kpis({ children }: { children: ReactNode }) {
  return <div className="kpis-informe">{children}</div>;
}

/** Un bloque del informe, con su título y una línea que dice cómo leerlo. */
export function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel bloque-informe">
      <h2 className="bloque-informe-titulo">{titulo}</h2>
      {ayuda && <p className="texto-suave texto-chico bloque-informe-ayuda">{ayuda}</p>}
      {children}
    </section>
  );
}

/**
 * Una barrita proporcional, para los rankings y el cumplimiento. Es HTML y no
 * un gráfico: se lee en una tabla, entra en el celular y sale igual en papel.
 */
export function Barrita({
  valor,
  maximo,
  tono = 'azul',
  texto,
}: {
  valor: number;
  maximo: number;
  tono?: Tono;
  texto?: ReactNode;
}) {
  const ancho = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return (
    <span className="barrita-informe">
      <span className="barrita-informe-pista" aria-hidden>
        <span
          className="barrita-informe-relleno"
          style={{ width: `${ancho}%`, background: COLOR[tono] }}
        />
      </span>
      <span className="barrita-informe-texto">{texto ?? valor}</span>
    </span>
  );
}

/** Lo que va arriba de la hoja impresa: el logo, qué informe es y de cuándo. */
export function MembreteImpreso({ titulo, periodo }: { titulo: string; periodo: PeriodoInforme }) {
  return (
    <div className="membrete-informe solo-imprimir">
      <LogoLasTres alto={44} />
      <div>
        <h1 className="membrete-informe-titulo">{titulo}</h1>
        <p className="membrete-informe-periodo">
          Período {textoPeriodo(periodo)} · emitido el {new Date().toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  );
}
