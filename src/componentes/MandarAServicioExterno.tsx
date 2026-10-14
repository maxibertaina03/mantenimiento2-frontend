import { useState } from 'react';
import { useCrearOrdenTrabajo } from '@/api/ordenesTrabajo';
import { apiRequest } from '@/lib/apiClient';
import { descargarPdfOrdenTrabajo } from '@/lib/pdfOrdenTrabajo';
import type { Equipo } from '@/tipos/equipo';
import { ETIQUETA_TIPO_TRABAJO, TIPOS_TRABAJO } from '@/tipos/ordenTrabajo';
import type { OrdenTrabajo, TipoTrabajo } from '@/tipos/ordenTrabajo';
import type { Proveedor } from '@/tipos/proveedor';
import { ComboProveedor } from './ComboProveedor';
import { EnviarOrdenTrabajo } from './EnviarOrdenTrabajo';
import { MensajeError } from './Estados';
import { Modal } from './Modal';

/**
 * Mandar el equipo a un taller o proveedor de afuera: llenar un tubo,
 * rebobinar una bomba.
 *
 * Abre una orden de trabajo para ese proveedor y baja el PDF, que viaja con
 * el equipo: dice a dónde va, qué hay que hacerle, deja lugar para que el
 * taller anote qué hizo, y tiene las firmas de quién lo entregó y quién lo
 * recibió. Cuando vuelve, se cierra la orden y queda en el historial.
 */
export function MandarAServicioExterno({
  equipo,
  onCerrar,
}: {
  equipo: Equipo;
  onCerrar: () => void;
}) {
  const crear = useCrearOrdenTrabajo();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoTrabajo>('CORRECTIVO');
  const [creada, setCreada] = useState<OrdenTrabajo | null>(null);
  const [errorPdf, setErrorPdf] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const imprimir = async (orden: OrdenTrabajo) => {
    setErrorPdf(false);
    try {
      // La ficha completa del proveedor (dirección, teléfono) va en el papel;
      // si no se puede traer, sale con lo que hay.
      const completo = await apiRequest<Proveedor>(`/proveedores/${orden.proveedorId}`).catch(
        () => proveedor,
      );
      await descargarPdfOrdenTrabajo(orden, { equipo, proveedor: completo });
    } catch {
      setErrorPdf(true);
    }
  };

  const mandar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedor) return;
    try {
      const orden = await crear.mutateAsync({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        equipoId: equipo.id,
        ejecutor: 'EXTERNO',
        proveedorId: proveedor.id,
      });
      setCreada(orden);
      await imprimir(orden);
    } catch {
      // El rechazo se muestra abajo, desde `crear.error`.
    }
  };

  if (creada && enviando) {
    return <EnviarOrdenTrabajo orden={creada} onCerrar={onCerrar} />;
  }

  if (creada) {
    return (
      <Modal titulo="Mandar a servicio externo" abierto onCerrar={onCerrar}>
        <div className="formulario-modal">
          <div className="alerta alerta-exito">
            ✔ Orden <strong>{creada.numero}</strong> abierta para{' '}
            <strong>{creada.proveedorNombre ?? proveedor?.nombre}</strong>. Se descargó el PDF:
            imprimilo para que viaje con el equipo y firmen al entregarlo.
          </div>
          {errorPdf && (
            <div className="alerta alerta-error">
              La orden quedó abierta, pero el PDF no se pudo armar. Probá de nuevo.
            </div>
          )}
          <p className="texto-suave texto-chico">
            El equipo figura «En reparación» mientras esté afuera. Cuando vuelva, tocá «Volvió del
            taller» en su ficha: se cierra la orden y queda en el historial.
          </p>
          <div className="acciones">
            <button type="button" className="btn" onClick={() => imprimir(creada)}>
              🖨 Descargar el PDF de nuevo
            </button>
            <button type="button" className="btn" onClick={() => setEnviando(true)}>
              ✉ Mandársela al taller
            </button>
            <button type="button" className="btn btn-primario" onClick={onCerrar}>
              Listo
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Mandar ${equipo.nombre} a servicio externo`} abierto onCerrar={onCerrar}>
      <form onSubmit={mandar} className="formulario-modal">
        <label className="campo">
          ¿A qué taller o proveedor va? *
          <ComboProveedor onCambio={setProveedor} />
        </label>

        <label className="campo">
          ¿Qué hay que hacerle? *
          <input
            type="text"
            value={titulo}
            maxLength={200}
            required
            placeholder="Ej: llenar el tubo, bobinado nuevo del motor"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <label className="campo">
          Detalle para el taller (opcional)
          <textarea
            rows={3}
            value={descripcion}
            maxLength={2000}
            placeholder="Lo que se vio, medidas, qué se probó, para cuándo hace falta"
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        <label className="campo">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTrabajo)}>
            {TIPOS_TRABAJO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_TRABAJO[t]}
              </option>
            ))}
          </select>
        </label>

        <p className="texto-suave texto-chico">
          Se abre una orden de trabajo y se descarga el PDF para imprimir: dice a dónde va el
          equipo, qué hay que hacerle, y tiene lugar para que el taller anote lo que hizo y para las
          firmas de quién lo entrega y quién lo recibe.
        </p>

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={crear.isPending || !proveedor || titulo.trim() === ''}
          >
            {crear.isPending ? 'Abriendo…' : '🖨 Abrir orden e imprimir'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
