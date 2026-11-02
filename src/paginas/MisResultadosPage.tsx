import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useInformeMio } from '@/api/informes';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { GraficoSerie } from '@/componentes/informes/GraficoSerie';
import { Bloque, Kpi, Kpis, MembreteImpreso } from '@/componentes/informes/piezas';
import { COLOR, textoPorcentaje, tonoCumplimiento } from '@/lib/formatoInforme';
import { SelectorPeriodo } from '@/componentes/informes/SelectorPeriodo';
import { periodoDeAtajo, textoPeriodo, type AtajoPeriodo } from '@/lib/periodoInforme';
import type { PeriodoInforme } from '@/tipos/informe';

/**
 * Lo que hizo cada uno, visto por él mismo.
 *
 * No pide permiso: cualquiera ve lo suyo, y solo lo suyo (el servidor contesta
 * con el usuario de la sesión, no con uno que se le pida). La comparación con
 * los demás está en Informes, para quien organiza.
 */
export function MisResultadosPage() {
  const [atajo, setAtajo] = useState<AtajoPeriodo>('mes');
  const [periodo, setPeriodo] = useState<PeriodoInforme>(() => periodoDeAtajo('mes'));
  const { data, isLoading, error } = useInformeMio(periodo);

  return (
    <>
      <div className="cabecera-pagina no-imprimir">
        <div>
          <h1>Mis resultados</h1>
          <p className="texto-suave">Tus tareas y tus órdenes de trabajo, {textoPeriodo(periodo)}.</p>
        </div>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Printer className="icono" aria-hidden />
          Imprimir
        </button>
      </div>

      <MembreteImpreso
        titulo={data ? `Resultados de ${data.resultado.nombre}` : 'Mis resultados'}
        periodo={periodo}
      />

      <SelectorPeriodo
        atajo={atajo}
        periodo={periodo}
        onCambio={(a, p) => {
          setAtajo(a);
          setPeriodo(p);
        }}
      />

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {data && (
        <>
          <Kpis>
            <Kpi
              etiqueta="Cumplimiento"
              valor={textoPorcentaje(data.resultado.cumplimiento)}
              tono={tonoCumplimiento(data.resultado.cumplimiento)}
              detalle={
                data.resultado.cumplimiento === null
                  ? 'no tenías tareas vencidas en el período'
                  : 'de tus tareas que ya vencieron, las que hiciste'
              }
            />
            <Kpi
              etiqueta="Tareas hechas"
              valor={data.resultado.tareasHechas}
              tono="verde"
              detalle={`${data.resultado.postergaciones} postergadas`}
            />
            <Kpi
              etiqueta="Vencidas sin hacer"
              valor={data.resultado.tareasVencidas}
              tono={data.resultado.tareasVencidas > 0 ? 'rojo' : 'gris'}
              detalle="todavía se pueden hacer"
            />
            <Kpi
              etiqueta="Órdenes cerradas"
              valor={data.resultado.otCerradas}
              tono="violeta"
              detalle={`${data.resultado.otAbiertas} abiertas a tu nombre hoy`}
            />
            {data.resultado.pendientesHechos > 0 && (
              <Kpi
                etiqueta="Pendientes resueltos"
                valor={data.resultado.pendientesHechos}
                detalle="del anotador"
              />
            )}
          </Kpis>

          <Bloque titulo="Cómo vas" ayuda="Las tareas que hiciste y las que se te vencieron.">
            <GraficoSerie
              datos={data.serie}
              agrupar={periodo.agrupar}
              series={[
                { clave: 'tareasHechas', nombre: 'Hechas', color: COLOR.verde, pila: 't' },
                { clave: 'tareasVencidas', nombre: 'Vencidas', color: COLOR.rojo, pila: 't' },
                { clave: 'otCerradas', nombre: 'Órdenes cerradas', color: COLOR.azul, linea: true },
              ]}
            />
          </Bloque>
        </>
      )}
    </>
  );
}
