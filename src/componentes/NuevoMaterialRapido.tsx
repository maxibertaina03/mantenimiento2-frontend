import { useState } from 'react';
import { useCategorias, useCrearCategoria } from '@/api/categorias';
import { useCrearMaterial } from '@/api/materiales';
import { useUnidadesMedida } from '@/api/unidadesMedida';
import { apiRequest } from '@/lib/apiClient';
import type { RespuestaPaginada } from '@/tipos/comunes';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import type { Material } from '@/tipos/material';

/**
 * El nombre que trae el rechazo «Ya existe un material llamado "X". Usá ese…».
 *
 * Hasta el `". Usá` y no hasta la primera comilla: medio catálogo va en
 * pulgadas («Union doble 1"») y el nombre corta mal.
 */
function nombreRepetido(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  return /Ya existe un material llamado "(.+)"\. Usá ese/.exec(error.message)?.[1] ?? null;
}

/**
 * Alta rápida de un material desde donde haga falta elegir uno.
 *
 * Nace de la orden de compra: es normal comprar algo que nunca se compró, y
 * mandar a la persona a la pantalla de Materiales le haría perder la orden que
 * venía cargando.
 *
 * Pide solo lo indispensable —nombre, categoría y unidad—. El stock mínimo y
 * las notas se completan después desde la ficha; exigirlos acá sería frenar a
 * alguien que está en el medio de otra tarea.
 */
export function NuevoMaterialRapido({
  nombreInicial,
  onCreado,
  onCerrar,
}: {
  /** El texto que se buscó y no apareció: casi siempre es el nombre buscado. */
  nombreInicial: string;
  onCreado: (material: Material) => void;
  onCerrar: () => void;
}) {
  const { data: categorias } = useCategorias();
  const { data: unidades } = useUnidadesMedida(true);
  const crear = useCrearMaterial();
  const crearCategoria = useCrearCategoria();

  const [nombre, setNombre] = useState(nombreInicial);
  const [categoriaId, setCategoriaId] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [modoNuevaCat, setModoNuevaCat] = useState(false);
  const [nombreCat, setNombreCat] = useState('');
  const [usandoExistente, setUsandoExistente] = useState(false);
  const [errorExistente, setErrorExistente] = useState<string | null>(null);

  /**
   * El material ya existe: casi siempre porque se creó en un intento anterior
   * que la persona no vio terminar. En vez de mandarla a buscarlo, se le
   * ofrece usarlo ahí mismo, igual que si lo acabara de crear.
   */
  const repetido = nombreRepetido(crear.error);
  const usarExistente = async (nombreExistente: string) => {
    setUsandoExistente(true);
    setErrorExistente(null);
    try {
      const encontrados = await apiRequest<RespuestaPaginada<Material>>('/materiales', {
        query: { buscar: nombreExistente, limite: 20, mostrar: 'todos' },
      });
      const existente = encontrados.datos.find((m) => m.nombre === nombreExistente);
      if (!existente) {
        setErrorExistente('No se encontró ese material. Buscalo por nombre en el combo.');
      } else if (!existente.activo) {
        setErrorExistente(
          `«${existente.nombre}» está desactivado. Reactivalo desde Materiales para poder usarlo.`,
        );
      } else {
        onCreado(existente);
      }
    } catch (error) {
      setErrorExistente(error instanceof Error ? error.message : 'No se pudo traer el material.');
    } finally {
      setUsandoExistente(false);
    }
  };

  const crearNuevaCategoria = () => {
    const limpio = nombreCat.trim();
    if (!limpio) return;
    crearCategoria.mutate(limpio, {
      onSuccess: (cat) => {
        setCategoriaId(cat.id); // queda elegida
        setNombreCat('');
        setModoNuevaCat(false);
      },
    });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const material = await crear.mutateAsync({
        nombre: nombre.trim(),
        categoriaId,
        unidadId,
      });
      onCreado(material);
    } catch {
      // El rechazo ya se muestra desde `crear.error` (y si es un nombre
      // repetido, con la opción de usar el que existe). Sin este catch quedaba
      // una excepción suelta en el navegador.
    }
  };

  return (
    <Modal titulo="Nuevo material" abierto onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <p className="texto-suave texto-chico">
          Se crea con stock 0. El stock se carga después con un movimiento o al recibir la orden.
        </p>

        <label>
          Nombre *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
            autoFocus
          />
        </label>

        <label>
          Categoría *
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            required
            disabled={modoNuevaCat}
          >
            <option value="">Elegí una categoría…</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        {modoNuevaCat ? (
          <>
            <div className="acciones-envio">
              <input
                autoFocus
                placeholder="Nombre de la nueva categoría"
                value={nombreCat}
                onChange={(e) => setNombreCat(e.target.value)}
                onKeyDown={(e) => {
                  // Enter acá crearía la orden entera si no se frena.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    crearNuevaCategoria();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primario"
                onClick={crearNuevaCategoria}
                disabled={crearCategoria.isPending}
              >
                {crearCategoria.isPending ? '…' : 'Crear'}
              </button>
              <button type="button" className="btn" onClick={() => setModoNuevaCat(false)}>
                Cancelar
              </button>
            </div>
            {crearCategoria.error && <MensajeError error={crearCategoria.error} />}
          </>
        ) : (
          <button type="button" className="boton-enlace" onClick={() => setModoNuevaCat(true)}>
            ＋ Crear una categoría nueva
          </button>
        )}

        <label>
          Unidad *
          <select value={unidadId} onChange={(e) => setUnidadId(e.target.value)} required>
            <option value="">Elegí una unidad…</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.simbolo})
              </option>
            ))}
          </select>
        </label>

        {repetido ? (
          <div className="aviso-repetido" role="alert">
            <p>
              ⚠️ Ya existe un material llamado <strong>«{repetido}»</strong>. Es el mismo: usá ese,
              así el stock queda en una sola ficha.
            </p>
            <button
              type="button"
              className="btn btn-primario"
              disabled={usandoExistente}
              onClick={() => usarExistente(repetido)}
            >
              {usandoExistente ? 'Trayéndolo…' : `Usar «${repetido}»`}
            </button>
            {errorExistente && <div className="alerta alerta-error">⚠️ {errorExistente}</div>}
          </div>
        ) : (
          crear.error && <MensajeError error={crear.error} />
        )}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={crear.isPending}>
            {crear.isPending ? 'Creando…' : 'Crear y usar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
