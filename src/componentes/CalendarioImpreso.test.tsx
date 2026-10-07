import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { diasDelMes } from '@/lib/fechasCalendario';
import type { Tarea } from '@/tipos/tarea';
import { CalendarioImpreso, type ModoImpresion } from './CalendarioImpreso';

/**
 * El calendario en papel. Lo que se cuida: que en la hoja salgan TODAS las
 * tareas —en el papel no hay «ver más»— sin que un día cargado desarme el resto.
 */
const ANCLA = new Date('2026-10-15T12:00:00');
const DIAS = diasDelMes(ANCLA);

let n = 0;
function tarea(fecha: string, titulo: string, extra: Partial<Tarea> = {}): Tarea {
  n += 1;
  return {
    id: `t-${n}`,
    titulo,
    descripcion: null,
    fecha: `${fecha}T00:00:00.000Z`,
    estado: 'PENDIENTE',
    asignadoAId: null,
    asignadoANombre: null,
    equipoId: null,
    equipoNombre: 'Compresor 1',
    equipoItId: null,
    equipoItNombre: null,
    ...extra,
  } as Tarea;
}

function porDia(tareas: Tarea[]) {
  const mapa = new Map<string, Tarea[]>();
  for (const t of tareas) {
    const k = t.fecha.slice(0, 10);
    mapa.set(k, [...(mapa.get(k) ?? []), t]);
  }
  return mapa;
}

function imprimir(modo: ModoImpresion, tareas: Tarea[], soloPendientes = false) {
  render(
    <CalendarioImpreso
      modo={modo}
      ancla={ANCLA}
      dias={DIAS}
      porDia={porDia(tareas)}
      colores={new Map()}
      personas={[]}
      soloPendientes={soloPendientes}
      hoy={new Date('2026-10-07T12:00:00')}
    />,
  );
}

// El lunes 12 cargado de purgas, como en la planta.
const PURGAS = Array.from({ length: 9 }, (_, i) => tarea('2026-10-12', `Purga ${i + 1}`));

describe('CalendarioImpreso', () => {
  it('la semana: los siete días, y el día cargado con todas sus tareas', () => {
    imprimir({ tipo: 'semana', semana: 2 }, [...PURGAS, tarea('2026-10-14', 'Agregar líquidos')]);

    expect(
      screen.getByRole('heading', { name: 'Semana del 12 al 18 de octubre de 2026' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d+/)).toHaveLength(7);
    expect(screen.getByText('Purga 9')).toBeInTheDocument();
    expect(screen.getByText('Agregar líquidos')).toBeInTheDocument();
    // Dónde y quién, en el renglón.
    expect(screen.getAllByText('Compresor 1 · sin repartir')).toHaveLength(10);
  });

  it('las hechas salen tildadas; con «solo lo que falta», no salen. Las canceladas nunca', () => {
    const tareas = [
      tarea('2026-10-13', 'Pendiente'),
      tarea('2026-10-13', 'Ya hecha', { estado: 'HECHA' }),
      tarea('2026-10-13', 'Cancelada', { estado: 'CANCELADA' }),
    ];

    imprimir({ tipo: 'semana', semana: 2 }, tareas);
    expect(screen.getByText('Ya hecha').closest('li')).toHaveTextContent('☑');
    expect(screen.queryByText('Cancelada')).not.toBeInTheDocument();
  });

  it('«solo lo que falta» deja afuera las hechas', () => {
    imprimir(
      { tipo: 'semana', semana: 2 },
      [tarea('2026-10-13', 'Pendiente'), tarea('2026-10-13', 'Ya hecha', { estado: 'HECHA' })],
      true,
    );
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Ya hecha')).not.toBeInTheDocument();
  });

  it('el mes: la grilla resume con «+N más», y la lista día por día trae todas', () => {
    imprimir({ tipo: 'mes' }, PURGAS);

    expect(screen.getByRole('heading', { name: 'Tareas de octubre de 2026' })).toBeInTheDocument();
    expect(screen.getByText('9 tareas')).toBeInTheDocument();
    expect(screen.getByText('+7 más')).toBeInTheDocument();

    const lista = screen.getByRole('heading', { name: /Día por día/ }).parentElement!;
    expect(within(lista).getByRole('heading', { name: /Lunes 12 de octubre/ })).toBeInTheDocument();
    expect(within(lista).getAllByRole('listitem')).toHaveLength(9);
  });

  it('la misma tarea en muchas máquinas va una vez, con un renglón y una casilla por máquina', () => {
    const purgas = ['Silo 6', 'Pinza 8', 'Piston 1'].map((equipoNombre) =>
      tarea('2026-10-12', 'Purgar separador de agua', { equipoNombre }),
    );
    imprimir({ tipo: 'semana', semana: 2 }, [...purgas, tarea('2026-10-12', 'Limpieza de filtro')]);

    expect(screen.getAllByText('Purgar separador de agua')).toHaveLength(1);
    expect(screen.getByText('Silo 6 · sin repartir').closest('li')).toHaveTextContent('☐');
    expect(screen.getByText('Piston 1 · sin repartir')).toBeInTheDocument();
    expect(screen.getByText('Limpieza de filtro')).toBeInTheDocument();
  });

  it('un mes sin tareas no imprime una hoja de lista vacía', () => {
    imprimir({ tipo: 'mes' }, []);
    expect(screen.queryByRole('heading', { name: /Día por día/ })).not.toBeInTheDocument();
  });
});
