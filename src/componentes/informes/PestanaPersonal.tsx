import { useInformePersonal } from '@/api/informes';
import { Cargando, EstadoVacio, MensajeError } from '../Estados';
import type { PeriodoInforme, ResultadoPersona } from '@/tipos/informe';
import { textoPorcentaje, tonoCumplimiento } from '@/lib/formatoInforme';
import { Barrita, Bloque, Kpi, Kpis } from './piezas';

/** Lo que cuenta como «hizo»: órdenes cerradas y tareas hechas. */
const hecho = (p: ResultadoPersona) => p.otCerradas + p.tareasHechas;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Qué hizo cada persona, comparada con las demás. Solo la ve quien tiene
 * `informes.personal`; lo propio cada uno lo ve en «Mis resultados».
 */
export function PestanaPersonal({ periodo }: { periodo: PeriodoInforme }) {
  const { data, isLoading, error } = useInformePersonal(periodo);
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data) return null;

  const personas = data.personas;
  if (personas.length === 0) return <EstadoVacio>Nadie tuvo actividad en el período.</EstadoVacio>;

  // El que más y el que menos, entre los de mantenimiento: comparar con
  // alguien de la oficina que cargó una orden de compra no dice nada.
  const deMantenimiento = personas.filter((p) => p.rol === 'MANTENIMIENTO');
  const comparables = deMantenimiento.length >= 2 ? deMantenimiento : personas;
  const masHizo = comparables.reduce((a, b) => (hecho(b) > hecho(a) ? b : a));
  const menosHizo = comparables.reduce((a, b) => (hecho(b) < hecho(a) ? b : a));
  const maximo = Math.max(...personas.map(hecho));

  const hechas = personas.reduce((t, p) => t + p.tareasHechas, 0);
  const vencidas = personas.reduce((t, p) => t + p.tareasVencidas, 0);
  const general = hechas + vencidas > 0 ? Math.round((hechas / (hechas + vencidas)) * 100) : null;

  // Más atrás de 30 días el calendario no genera tareas: solo cuentan las que
  // se generaron cuando alguien lo abrió.
  const desdeHace = (Date.now() - new Date(`${periodo.desde}T00:00:00`).getTime()) / UN_DIA_MS;

  return (
    <>
      <Kpis>
        <Kpi
          etiqueta="Cumplimiento del equipo"
          valor={textoPorcentaje(general)}
          tono={tonoCumplimiento(general)}
          detalle={`${hechas} tareas hechas · ${vencidas} vencidas sin hacer`}
        />
        <Kpi
          etiqueta="Hizo más"
          valor={masHizo.nombre}
          tono="verde"
          detalle={`${masHizo.otCerradas} órdenes · ${masHizo.tareasHechas} tareas`}
        />
        {menosHizo.usuarioId !== masHizo.usuarioId && (
          <Kpi
            etiqueta="Hizo menos"
            valor={menosHizo.nombre}
            tono="ambar"
            detalle={`${menosHizo.otCerradas} órdenes · ${menosHizo.tareasHechas} tareas`}
          />
        )}
        <Kpi
          etiqueta="Vencidas sin responsable"
          valor={data.vencidasSinResponsable}
          tono={data.vencidasSinResponsable > 0 ? 'rojo' : 'gris'}
          detalle="no eran de nadie: no se le cuentan a ninguno"
        />
      </Kpis>

      <Bloque
        titulo="Resultados por persona"
        ayuda="Cumplimiento: de las tareas suyas que ya vencieron, cuántas hizo. Las de hoy en adelante todavía no cuentan."
      >
        <div className="tabla-scroll">
          <table className="tabla tabla-informe">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Hizo</th>
                <th className="numero">Órdenes cerradas</th>
                <th className="numero">Tareas hechas</th>
                <th className="numero">Vencidas</th>
                <th>Cumplimiento</th>
                <th className="numero">Postergó</th>
                <th className="numero">Pendientes</th>
                <th className="numero">OC cargadas</th>
                <th className="numero">OT abiertas hoy</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.usuarioId}>
                  <td>
                    <strong>{p.nombre}</strong>
                  </td>
                  <td>
                    <Barrita valor={hecho(p)} maximo={maximo} />
                  </td>
                  <td className="numero">{p.otCerradas}</td>
                  <td className="numero">{p.tareasHechas}</td>
                  <td className="numero">{p.tareasVencidas}</td>
                  <td>
                    <Barrita
                      valor={p.cumplimiento ?? 0}
                      maximo={100}
                      tono={tonoCumplimiento(p.cumplimiento)}
                      texto={textoPorcentaje(p.cumplimiento)}
                    />
                  </td>
                  <td className="numero">{p.postergaciones}</td>
                  <td className="numero">{p.pendientesHechos}</td>
                  <td className="numero">{p.ocCreadas}</td>
                  <td className="numero">{p.otAbiertas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {desdeHace > 30 && (
          <p className="texto-suave texto-chico">
            Antes de los últimos 30 días, las tareas de los planes y rutinas cuentan solo si alguien
            abrió el calendario esos días: las que nunca se generaron no figuran como vencidas.
          </p>
        )}
      </Bloque>
    </>
  );
}
