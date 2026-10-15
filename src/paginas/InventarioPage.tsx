import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategorias } from '@/api/categorias';
import { useEstanterias } from '@/api/estanterias';
import { useAbrirToma, useTomas } from '@/api/inventario';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { alcanceDeToma, ETIQUETA_ESTADO_TOMA, type EstadoToma } from '@/tipos/inventario';

const CLASE_ESTADO: Record<EstadoToma, string> = {
  ABIERTA: 'badge badge-aviso',
  CERRADA: 'badge badge-ok',
  ANULADA: 'badge',
};

/**
 * Las tomas de inventario: contar lo que hay en el pañol y ajustar el stock.
 *
 * Una toma se abre sobre una categoría, una estantería o todo el pañol; se
 * cuenta desde el celular o con la planilla impresa, y al confirmarla cada
 * diferencia se ajusta.
 */
export function InventarioPage() {
  const puede = usePuede();
  const navegar = useNavigate();
  const { data, isLoading, error } = useTomas();
  const [abriendo, setAbriendo] = useState(false);

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Toma de inventario</h1>
          <p className="texto-suave">
            Contar lo que hay en el pañol y ajustar el stock a lo contado. Se puede hacer por
            categoría, por estantería o todo junto.
          </p>
        </div>
        {puede(P.MOVIMIENTOS_CREAR) && (
          <button className="btn btn-primario" onClick={() => setAbriendo(true)}>
            + Nueva toma
          </button>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {data && data.length === 0 && (
        <EstadoVacio>Todavía no se hizo ninguna toma de inventario.</EstadoVacio>
      )}

      {data && data.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Número</th>
                <th>Qué se cuenta</th>
                <th>Avance</th>
                <th>Abierta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr
                  key={t.id}
                  className="fila-clickeable"
                  onClick={() => navegar(`/inventario/${t.id}`)}
                >
                  <td data-etiqueta="Número">
                    <strong>{t.numero}</strong>
                  </td>
                  <td data-etiqueta="Qué se cuenta">{alcanceDeToma(t)}</td>
                  <td data-etiqueta="Avance">
                    {t.contados} de {t.totalRenglones} contados
                  </td>
                  <td data-etiqueta="Abierta">
                    {formatearFecha(t.abiertaEn)}
                    {t.abiertaPorNombre && (
                      <div className="texto-suave texto-chico">{t.abiertaPorNombre}</div>
                    )}
                  </td>
                  <td data-etiqueta="Estado">
                    <span className={CLASE_ESTADO[t.estado]}>{ETIQUETA_ESTADO_TOMA[t.estado]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abriendo && (
        <NuevaToma
          onCerrar={() => setAbriendo(false)}
          onAbierta={(id) => navegar(`/inventario/${id}`)}
        />
      )}
    </>
  );
}

function NuevaToma({
  onCerrar,
  onAbierta,
}: {
  onCerrar: () => void;
  onAbierta: (id: string) => void;
}) {
  const abrir = useAbrirToma();
  const { data: categorias } = useCategorias();
  const { data: estanterias } = useEstanterias(true);
  const [categoriaId, setCategoriaId] = useState('');
  const [estanteriaId, setEstanteriaId] = useState('');
  const [notas, setNotas] = useState('');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const toma = await abrir.mutateAsync({
        categoriaId: categoriaId || undefined,
        estanteriaId: estanteriaId || undefined,
        notas: notas.trim() || undefined,
      });
      onAbierta(toma.id);
    } catch {
      // El rechazo se muestra abajo.
    }
  };

  return (
    <Modal titulo="Nueva toma de inventario" abierto onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={enviar}>
        <p className="texto-suave texto-chico">
          Elegí qué contar. Sin elegir nada, se cuenta todo el pañol. Se arma la lista de los
          materiales en uso, ordenada por estantería y fila.
        </p>
        <label className="campo">
          Categoría
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todas</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Estantería
          <select value={estanteriaId} onChange={(e) => setEstanteriaId(e.target.value)}>
            <option value="">Todas</option>
            {(estanterias ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Notas (opcional)
          <input
            value={notas}
            maxLength={500}
            placeholder="Ej: conteo de fin de mes"
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
        {abrir.error && <MensajeError error={abrir.error} />}
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={abrir.isPending}>
            {abrir.isPending ? 'Armando la lista…' : 'Abrir la toma'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
