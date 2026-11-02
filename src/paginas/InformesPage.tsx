import { Printer } from 'lucide-react';
import { useState } from 'react';
import { MembreteImpreso } from '@/componentes/informes/piezas';
import { PestanaCompras } from '@/componentes/informes/PestanaCompras';
import { PestanaPanol } from '@/componentes/informes/PestanaPanol';
import { PestanaPersonal } from '@/componentes/informes/PestanaPersonal';
import { PestanaTrabajos } from '@/componentes/informes/PestanaTrabajos';
import { SelectorPeriodo } from '@/componentes/informes/SelectorPeriodo';
import { P, usePuede } from '@/lib/permisos';
import { periodoDeAtajo, textoPeriodo, type AtajoPeriodo } from '@/lib/periodoInforme';
import type { PeriodoInforme } from '@/tipos/informe';

type Pestana = 'trabajos' | 'compras' | 'personal' | 'panol';

const TITULOS: Record<Pestana, string> = {
  trabajos: 'Trabajos',
  compras: 'Compras',
  personal: 'Personal',
  panol: 'Pañol',
};

/**
 * Los informes: lo que pasó en un período, en números y gráficos.
 *
 * Todo sale de lo que ya se carga; no hay nada que llenar. «Imprimir» saca la
 * pestaña que se está mirando con el membrete de la empresa, y desde el mismo
 * diálogo se puede guardar como PDF.
 */
export function InformesPage() {
  const puede = usePuede();
  const verPersonal = puede(P.INFORMES_PERSONAL);
  const [atajo, setAtajo] = useState<AtajoPeriodo>('mes');
  const [periodo, setPeriodo] = useState<PeriodoInforme>(() => periodoDeAtajo('mes'));
  const [pestana, setPestana] = useState<Pestana>('trabajos');

  const pestanas = (['trabajos', 'compras', 'personal', 'panol'] as Pestana[]).filter(
    (p) => p !== 'personal' || verPersonal,
  );

  return (
    <>
      <div className="cabecera-pagina no-imprimir">
        <div>
          <h1>Informes</h1>
          <p className="texto-suave">Lo que pasó {textoPeriodo(periodo)}.</p>
        </div>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Printer className="icono" aria-hidden />
          Imprimir
        </button>
      </div>

      <MembreteImpreso titulo={`Informe de ${TITULOS[pestana].toLowerCase()}`} periodo={periodo} />

      <SelectorPeriodo
        atajo={atajo}
        periodo={periodo}
        onCambio={(a, p) => {
          setAtajo(a);
          setPeriodo(p);
        }}
      />

      <div className="pestanas-equipo no-imprimir" role="tablist" aria-label="Informes">
        {pestanas.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pestana === p}
            className={pestana === p ? 'pestana-equipo activa' : 'pestana-equipo'}
            onClick={() => setPestana(p)}
          >
            {TITULOS[p]}
          </button>
        ))}
      </div>

      <div className="contenido-informe" role="tabpanel">
        {pestana === 'trabajos' && <PestanaTrabajos periodo={periodo} />}
        {pestana === 'compras' && <PestanaCompras periodo={periodo} />}
        {pestana === 'personal' && verPersonal && <PestanaPersonal periodo={periodo} />}
        {pestana === 'panol' && <PestanaPanol periodo={periodo} />}
      </div>
    </>
  );
}
