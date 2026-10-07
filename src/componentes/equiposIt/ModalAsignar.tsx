import { useMemo, useState } from 'react';
import { useAsignarEquipo } from '@/api/equiposIt';
import { useCrearResponsable, useResponsables } from '@/api/responsables';
import { SelectorCatalogo } from '@/componentes/SelectorCatalogo';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import type { EquipoIt } from '@/tipos/equipoIt';
import { nombreDelEquipo } from './comun';

export function ModalAsignar({ equipo, alCerrar }: { equipo: EquipoIt; alCerrar: () => void }) {
  // Responsables, NO usuarios del sistema: quien tiene el equipo casi nunca
  // entra al sistema, y a veces ni siquiera es una persona.
  const { data: responsables } = useResponsables(true);
  const crearResponsable = useCrearResponsable();
  const asignar = useAsignarEquipo(equipo.id);
  const [responsableId, setResponsableId] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  const opciones = useMemo(() => responsables ?? [], [responsables]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await asignar.mutateAsync({
      responsableId: responsableId || null,
      motivo: motivo || undefined,
    });
    alCerrar();
  };

  return (
    <Modal titulo={`¿Quién tiene ${nombreDelEquipo(equipo)}?`} abierto onCerrar={alCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <p className="texto-suave">
          Actualmente: <strong>{equipo.responsableNombre ?? 'en depósito'}</strong>
        </p>

        <SelectorCatalogo
          id="asignar-responsable"
          etiqueta="Queda a cargo de"
          valor={responsableId}
          opciones={opciones}
          creando={crearResponsable.isPending}
          placeholder="— Devolver a depósito —"
          placeholderNuevo="Nombre de la persona o del sector"
          ayuda="Puede ser una persona o un sector. No es un usuario del sistema."
          onCambiar={setResponsableId}
          onCrear={async (nombre) => (await crearResponsable.mutateAsync({ nombre })).id}
        />

        <label>
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ingreso de personal, cambio de sector, reparación…"
            minLength={3}
          />
        </label>

        {asignar.error && <MensajeError error={asignar.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={asignar.isPending}>
            {asignar.isPending ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
