import { useEffect, useState } from 'react';
import {
  useHistorialCredencial,
  useRevelarCredencial,
  useRotarCredencial,
  type Credencial,
  type SecretoRevelado,
} from '@/api/credenciales';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

/** Cuántos segundos queda la contraseña en pantalla antes de taparse sola. */
const SEGUNDOS_VISIBLE = 30;

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Ver la contraseña.
 *
 * Se tapa sola a los treinta segundos y al cerrar. No es teatro: la pantalla
 * queda abierta en una oficina donde pasa gente, y una contraseña que quedó
 * visible en un monitor es la forma más común de que se filtre una.
 */
export function VerSecreto({
  credencial,
  onCerrar,
  segundosVisible = SEGUNDOS_VISIBLE,
}: {
  credencial: Credencial;
  onCerrar: () => void;
  /** Se puede acortar en las pruebas, para no esperar medio minuto de verdad. */
  segundosVisible?: number;
}) {
  const revelar = useRevelarCredencial();
  const [revelado, setRevelado] = useState<SecretoRevelado | null>(null);
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), segundosVisible * 1000);
    return () => clearTimeout(t);
  }, [visible, segundosVisible]);

  const pedir = async () => {
    const r = await revelar.mutateAsync(credencial.id);
    setRevelado(r);
    setVisible(true);
  };

  const copiar = async () => {
    if (!revelado) return;
    try {
      await navigator.clipboard.writeText(revelado.secreto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer: queda mostrarla.
      setVisible(true);
    }
  };

  return (
    <Modal titulo={credencial.nombre} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <div>
            <span className="texto-suave texto-chico">Usuario</span>
            <div>{credencial.usuario ?? '—'}</div>
          </div>
          {credencial.url && (
            <div>
              <span className="texto-suave texto-chico">Dónde se usa</span>
              <div>{credencial.url}</div>
            </div>
          )}
        </div>

        {!revelado && (
          <>
            <div className="alerta alerta-aviso">
              Al mostrarla queda registrado que <strong>vos</strong> la viste, con la fecha y la
              hora. El registro se puede consultar en el historial.
            </div>
            {revelar.error && <MensajeError error={revelar.error} />}
            <div className="acciones">
              <button className="btn" onClick={onCerrar}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                onClick={pedir}
                disabled={revelar.isPending}
                autoFocus
              >
                {revelar.isPending ? 'Pidiendo…' : '👁 Mostrar la contraseña'}
              </button>
            </div>
          </>
        )}

        {revelado && (
          <>
            <div className="campo">
              <label htmlFor="secreto-revelado">Contraseña</label>
              <input
                id="secreto-revelado"
                readOnly
                type={visible ? 'text' : 'password'}
                value={revelado.secreto}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>

            <p className="texto-suave texto-chico">
              {visible
                ? `Se va a tapar sola en ${segundosVisible} segundos.`
                : 'Está tapada. Podés copiarla sin mostrarla.'}
            </p>

            <div className="acciones">
              <button className="btn" onClick={() => setVisible((v) => !v)}>
                {visible ? '🙈 Tapar' : '👁 Mostrar'}
              </button>
              <button className="btn" onClick={copiar}>
                {copiado ? '✓ Copiada' : '📋 Copiar'}
              </button>
              <button className="btn btn-primario" onClick={onCerrar}>
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Cambiar la contraseña.
 *
 * Pide escribirla dos veces. Una credencial que se guarda mal tipeada no avisa:
 * se descubre el día que alguien la necesita y no entra, que suele ser el peor
 * día posible.
 */
export function RotarCredencial({
  credencial,
  onCerrar,
}: {
  credencial: Credencial;
  onCerrar: () => void;
}) {
  const rotar = useRotarCredencial();
  const [secreto, setSecreto] = useState('');
  const [repetida, setRepetida] = useState('');
  const [motivo, setMotivo] = useState('');
  const [visible, setVisible] = useState(false);

  const coinciden = secreto.length > 0 && secreto === repetida;
  const noCoinciden = repetida.length > 0 && secreto !== repetida;

  const confirmar = async () => {
    if (!coinciden) return;
    await rotar.mutateAsync({ id: credencial.id, secreto, motivo: motivo.trim() || undefined });
    onCerrar();
  };

  return (
    <Modal titulo={`Cambiar la contraseña de ${credencial.nombre}`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave texto-chico">
          La contraseña anterior no se guarda. Queda anotado que se cambió, cuándo y quién.
        </p>

        <div className="campo">
          <label htmlFor="rotar-nueva">Contraseña nueva</label>
          <input
            id="rotar-nueva"
            type={visible ? 'text' : 'password'}
            value={secreto}
            autoFocus
            autoComplete="new-password"
            onChange={(e) => setSecreto(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="rotar-repetir">Repetila</label>
          <input
            id="rotar-repetir"
            type={visible ? 'text' : 'password'}
            value={repetida}
            autoComplete="new-password"
            onChange={(e) => setRepetida(e.target.value)}
          />
          {noCoinciden && (
            <span className="badge badge-error texto-chico">No son iguales.</span>
          )}
        </div>

        <label className="filtro-check">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Mostrar lo que escribo
        </label>

        <div className="campo">
          <label htmlFor="rotar-motivo">Por qué se cambia (opcional)</label>
          <input
            id="rotar-motivo"
            value={motivo}
            placeholder="Venció, se fue alguien, sospecha…"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        {rotar.error && <MensajeError error={rotar.error} />}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn btn-primario"
            onClick={confirmar}
            disabled={!coinciden || rotar.isPending}
          >
            {rotar.isPending ? 'Guardando…' : 'Cambiar la contraseña'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Cuándo se cambió, y quién vio la contraseña. */
export function HistorialCredencial({
  credencial,
  onCerrar,
}: {
  credencial: Credencial;
  onCerrar: () => void;
}) {
  const { data, isLoading, error } = useHistorialCredencial(credencial.id);

  return (
    <Modal titulo={`Historial de ${credencial.nombre}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {data && (
          <>
            <h3 className="subtitulo-form">Cambios de contraseña</h3>
            {data.rotaciones.length === 0 ? (
              <EstadoVacio>Nunca se cambió desde que se cargó.</EstadoVacio>
            ) : (
              <ul className="lista-catalogo">
                {data.rotaciones.map((r) => (
                  <li key={r.id}>
                    <span>{fecha(r.rotadaEn)}</span>
                    <span className="texto-suave texto-chico">
                      {r.rotadaPor ?? 'alguien'}
                      {r.motivo ? ` · ${r.motivo}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="subtitulo-form">Quién vio la contraseña</h3>
            {data.vistas.length === 0 ? (
              <EstadoVacio>Todavía nadie la miró.</EstadoVacio>
            ) : (
              <ul className="lista-catalogo">
                {data.vistas.map((v) => (
                  <li key={v.id}>
                    <span>{v.usuario}</span>
                    <span className="texto-suave texto-chico">{fecha(v.vistaEn)}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* Se muestran las últimas cincuenta: el listado completo de vistas
                crece sin techo y nadie lee más allá de las primeras. */}
            <p className="texto-suave texto-chico">Se muestran las últimas 50 consultas.</p>
          </>
        )}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
