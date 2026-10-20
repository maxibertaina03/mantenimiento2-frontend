import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useAnularToma,
  useCerrarToma,
  useConfirmarToma,
  useContar,
  useToma,
} from '@/api/inventario';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { leerEscaneo, useEscaneoSuelto } from '@/lib/escaneo';
import { formatearFecha, formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { descargarInforme, descargarPlanilla, ubicacionDe } from '@/lib/pdfTomaInventario';
import {
  alcanceDeToma,
  ETIQUETA_ESTADO_TOMA,
  type DetalleToma,
  type RenglonToma,
  type ResultadoConfirmacion,
} from '@/tipos/inventario';

type Vista = 'porContar' | 'contados' | 'diferencias' | 'recontar' | 'todos';

const iguales = (a: number, b: number) => Math.round(a * 1000) === Math.round(b * 1000);

/** Ya confirmado: no se vuelve a tocar. */
const resuelto = (r: RenglonToma) => r.resultado === 'AJUSTADO' || r.resultado === 'SIN_DIFERENCIA';

/** Contado, sin confirmar todavía, y con diferencia contra lo que figuraba al contarlo. */
function difiere(r: RenglonToma): boolean {
  return (
    r.contado !== null &&
    r.stockAlContar !== null &&
    !resuelto(r) &&
    !iguales(r.contado, r.stockAlContar)
  );
}

const RESULTADO = {
  AJUSTADO: { texto: 'Ajustado', clase: 'badge badge-ok' },
  SIN_DIFERENCIA: { texto: 'Sin diferencia', clase: 'badge' },
  RECONTAR: { texto: 'Volver a contar', clase: 'badge badge-bajo' },
} as const;

/**
 * Una toma de inventario: contar, mirar las diferencias y ajustar.
 *
 * Mientras se cuenta no se muestra cuánto figura: el que cuenta escribe lo
 * que ve, no lo que espera ver. Las diferencias aparecen en su propia pestaña,
 * para revisarlas antes de confirmar.
 *
 * Pensada para el celular: un renglón por material, ordenados como se recorre
 * el pañol, y lo contado se guarda al salir del campo. Escanear el QR de un
 * material lo trae directo.
 */
export function TomaInventarioPage() {
  const { id = '' } = useParams();
  const puede = usePuede();
  const { data, isLoading, error } = useToma(id);
  const confirmar = useConfirmarToma(id);
  const anular = useAnularToma(id);
  const cerrar = useCerrarToma(id);

  const [vista, setVista] = useState<Vista | null>(null);
  const [buscar, setBuscar] = useState('');
  const [soloMaterial, setSoloMaterial] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConfirmacion | null>(null);

  // Escanear la etiqueta de un material (con el cursor fuera de un campo) lo trae.
  useEscaneoSuelto(Boolean(data), (escaneo) => {
    if (escaneo.clase === 'material' || escaneo.clase === 'sin-dato') setSoloMaterial(escaneo.id);
  });

  const renglones = data?.renglones ?? [];
  const cuenta = useMemo(
    () => ({
      porContar: renglones.filter((r) => r.contado === null).length,
      contados: renglones.filter((r) => r.contado !== null).length,
      diferencias: renglones.filter(difiere).length,
      recontar: renglones.filter((r) => r.resultado === 'RECONTAR').length,
      todos: renglones.length,
    }),
    [renglones],
  );

  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data) return null;

  const { toma, resumen } = data;
  const abierta = toma.estado === 'ABIERTA';
  const puedeContar = abierta && puede(P.INVENTARIO_CONTAR);
  const puedeConfirmar = abierta && puede(P.INVENTARIO_AJUSTAR);
  /** Contados que todavía no se confirmaron: lo que «Confirmar» va a procesar. */
  const porConfirmar = renglones.filter((r) => r.contado !== null && !resuelto(r)).length;
  // Abierta: lo que falta contar (o volver a contar); cerrada: todo.
  const vistaActual: Vista =
    vista ?? (!abierta ? 'todos' : cuenta.recontar > 0 ? 'recontar' : 'porContar');

  const texto = buscar.trim().toLocaleLowerCase('es');
  const visibles = renglones.filter((r) => {
    if (soloMaterial) return r.materialId === soloMaterial;
    if (texto && !r.materialNombre.toLocaleLowerCase('es').includes(texto)) return false;
    if (vistaActual === 'porContar') return r.contado === null;
    if (vistaActual === 'contados') return r.contado !== null;
    if (vistaActual === 'diferencias') return difiere(r);
    if (vistaActual === 'recontar') return r.resultado === 'RECONTAR';
    return true;
  });

  // Agrupados por estantería, como se recorre el pañol.
  const grupos: { titulo: string; renglones: RenglonToma[] }[] = [];
  for (const r of visibles) {
    const titulo = r.estanteriaNombre ? `Estantería ${r.estanteriaNombre}` : 'Sin ubicación';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.titulo === titulo) ultimo.renglones.push(r);
    else grupos.push({ titulo, renglones: [r] });
  }

  const pestanas: { id: Vista; titulo: string; n: number }[] = [
    { id: 'porContar', titulo: 'Por contar', n: cuenta.porContar },
    { id: 'contados', titulo: 'Contados', n: cuenta.contados },
    { id: 'diferencias', titulo: 'Con diferencia', n: cuenta.diferencias },
    ...(cuenta.recontar > 0
      ? [{ id: 'recontar' as const, titulo: 'Volver a contar', n: cuenta.recontar }]
      : []),
    { id: 'todos', titulo: 'Todos', n: cuenta.todos },
  ];

  return (
    <>
      <Link to="/inventario" className="texto-suave volver">
        ← Tomas de inventario
      </Link>

      <div className="panel cabecera-toma">
        <div className="cabecera-toma-titulo">
          <h1>{toma.numero}</h1>
          <span
            className={
              abierta ? 'badge badge-aviso' : toma.estado === 'CERRADA' ? 'badge badge-ok' : 'badge'
            }
          >
            {ETIQUETA_ESTADO_TOMA[toma.estado]}
          </span>
        </div>
        <p className="texto-suave texto-chico">
          {alcanceDeToma(toma)} · abierta el {formatearFecha(toma.abiertaEn)}
          {toma.abiertaPorNombre ? ` por ${toma.abiertaPorNombre}` : ''}
          {toma.cerradaEn && toma.estado === 'CERRADA'
            ? ` · cerrada el ${formatearFecha(toma.cerradaEn)}${toma.cerradaPorNombre ? ` por ${toma.cerradaPorNombre}` : ''}`
            : ''}
          {toma.notas ? ` · ${toma.notas}` : ''}
        </p>
        {toma.estado === 'ANULADA' && (
          <p className="texto-suave">Anulada: {toma.motivoAnulacion}</p>
        )}

        <div
          className="avance-toma"
          aria-label={`${resumen.contados} de ${resumen.total} contados`}
        >
          <div
            className="avance-toma-barra"
            style={{ width: `${resumen.total ? (100 * resumen.contados) / resumen.total : 0}%` }}
          />
        </div>
        <p className="texto-chico">
          <strong>
            {resumen.contados} de {resumen.total}
          </strong>{' '}
          contados · {resumen.conDiferencia} con diferencia
          {resumen.ajustados > 0 && ` · ${resumen.ajustados} ajustados`}
          {resumen.recontar > 0 && ` · ${resumen.recontar} para volver a contar`}
        </p>

        <div className="fila-acciones">
          {puedeConfirmar && (
            <button
              className="btn btn-primario"
              disabled={porConfirmar === 0}
              title={porConfirmar === 0 ? 'No hay conteos nuevos para confirmar' : undefined}
              onClick={() => setConfirmando(true)}
            >
              ✔ Confirmar y ajustar
            </button>
          )}
          <button className="btn" onClick={() => void descargarPlanilla(data)}>
            🖨 Planilla para contar
          </button>
          {resumen.contados > 0 && (
            <button className="btn" onClick={() => void descargarInforme(data)}>
              🖨 Informe
            </button>
          )}
          {puedeConfirmar && resumen.contados > 0 && (
            <button
              className="btn"
              disabled={cerrar.isPending}
              onClick={() => {
                const aviso =
                  resumen.sinContar > 0
                    ? `¿Dar por terminada la toma? Quedan ${resumen.sinContar} materiales sin contar: su stock no se toca.`
                    : '¿Dar por terminada la toma?';
                if (confirm(aviso)) cerrar.mutate();
              }}
            >
              Cerrar la toma
            </button>
          )}
          {puedeConfirmar && resumen.ajustados === 0 && (
            <button
              className="btn btn-peligro"
              disabled={anular.isPending}
              onClick={() => {
                const motivo = prompt('¿Por qué se anula esta toma?');
                if (motivo) anular.mutate(motivo);
              }}
            >
              Anular
            </button>
          )}
        </div>
        {anular.error && <MensajeError error={anular.error} />}
        {cerrar.error && <MensajeError error={cerrar.error} />}
      </div>

      {resultado && <ResultadoDeConfirmar resultado={resultado} />}

      <div className="pestanas-equipo" role="tablist" aria-label="Qué mostrar">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={vistaActual === p.id && !soloMaterial}
            className={
              vistaActual === p.id && !soloMaterial ? 'pestana-equipo activa' : 'pestana-equipo'
            }
            onClick={() => {
              setVista(p.id);
              setSoloMaterial(null);
            }}
          >
            {p.titulo}
            {p.n > 0 && <span className="contador-pestana">{p.n}</span>}
          </button>
        ))}
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar material, o escanear su QR…"
          value={buscar}
          onChange={(e) => {
            // Una pistola escribe la dirección de la etiqueta en el campo.
            const escaneo = leerEscaneo(e.target.value);
            if (escaneo && (escaneo.clase === 'material' || escaneo.clase === 'sin-dato')) {
              setSoloMaterial(escaneo.id);
              setBuscar('');
            } else {
              setBuscar(e.target.value);
            }
          }}
        />
      </div>
      {soloMaterial && (
        <p className="texto-chico">
          Mostrando el material escaneado.{' '}
          <button type="button" className="btn btn-chico" onClick={() => setSoloMaterial(null)}>
            ✕ Ver todos
          </button>
        </p>
      )}

      {visibles.length === 0 && (
        <p className="texto-suave">
          {soloMaterial
            ? 'Ese material no está en esta toma.'
            : vistaActual === 'porContar'
              ? 'No queda nada por contar.'
              : 'No hay nada para mostrar acá.'}
        </p>
      )}

      {grupos.map((g) => (
        <div key={g.titulo} className="grupo-toma">
          <h2 className="grupo-toma-titulo">{g.titulo}</h2>
          {g.renglones.map((r) => (
            <RenglonConteo
              key={r.id}
              tomaId={id}
              renglon={r}
              editable={
                puedeContar && r.resultado !== 'AJUSTADO' && r.resultado !== 'SIN_DIFERENCIA'
              }
              // Lo que figura recién se muestra cuando ya se contó: el que cuenta
              // escribe lo que ve, no lo que espera ver.
              mostrarFigura={r.contado !== null}
            />
          ))}
        </div>
      ))}

      {confirmando && (
        <ConfirmarToma
          detalle={data}
          pendiente={confirmar.isPending}
          error={confirmar.error}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={async () => {
            try {
              const res = await confirmar.mutateAsync();
              setResultado(res);
              setConfirmando(false);
              setVista(null);
            } catch {
              // El rechazo se muestra en el modal.
            }
          }}
        />
      )}
    </>
  );
}

/** Un material: dónde está, el campo para lo contado y, si ya se contó, la diferencia. */
function RenglonConteo({
  tomaId,
  renglon,
  editable,
  mostrarFigura,
}: {
  tomaId: string;
  renglon: RenglonToma;
  editable: boolean;
  mostrarFigura: boolean;
}) {
  const contar = useContar(tomaId);
  const guardado = renglon.contado === null ? '' : String(renglon.contado);
  const [valor, setValor] = useState(guardado);
  useEffect(() => setValor(guardado), [guardado]);

  const guardar = () => {
    const limpio = valor.trim().replace(',', '.');
    if (limpio === guardado) return;
    const numero = limpio === '' ? null : Number(limpio);
    if (numero !== null && (!Number.isFinite(numero) || numero < 0)) return;
    contar.mutate({ renglonId: renglon.id, contado: numero });
  };

  const diferencia =
    renglon.contado !== null && renglon.stockAlContar !== null
      ? renglon.contado - renglon.stockAlContar
      : null;

  return (
    <div
      className={`renglon-toma${diferencia !== null && !iguales(diferencia, 0) ? ' renglon-toma-difiere' : ''}`}
    >
      <div className="renglon-toma-material">
        <strong>{renglon.materialNombre}</strong>
        <span className="texto-suave texto-chico">
          {ubicacionDe(renglon)} · {renglon.unidad}
          {renglon.contadoPorNombre && ` · contó ${renglon.contadoPorNombre}`}
        </span>
        {mostrarFigura && renglon.stockAlContar !== null && (
          <span className="texto-chico">
            Figuraba {formatearNumero(renglon.stockAlContar)}
            {diferencia !== null && !iguales(diferencia, 0) && (
              <strong>
                {' '}
                · {diferencia > 0 ? 'sobran' : 'faltan'} {formatearNumero(Math.abs(diferencia))}
              </strong>
            )}
          </span>
        )}
      </div>
      <div className="renglon-toma-conteo">
        {renglon.resultado && (
          <span className={RESULTADO[renglon.resultado].clase}>
            {RESULTADO[renglon.resultado].texto}
          </span>
        )}
        {editable ? (
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Contado de ${renglon.materialNombre}`}
            placeholder="Contado"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <span className="renglon-toma-valor">
            {renglon.contado === null ? '—' : formatearNumero(renglon.contado)}
          </span>
        )}
        <span className="renglon-toma-estado texto-chico" aria-live="polite">
          {contar.isPending
            ? 'Guardando…'
            : contar.isError
              ? '⚠ No se guardó'
              : contar.isSuccess
                ? '✓'
                : ''}
        </span>
      </div>
      {contar.error && <MensajeError error={contar.error} />}
    </div>
  );
}

/** Antes de ajustar: qué va a pasar, en números. */
function ConfirmarToma({
  detalle,
  pendiente,
  error,
  onCancelar,
  onConfirmar,
}: {
  detalle: DetalleToma;
  pendiente: boolean;
  error: Error | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const { resumen, renglones } = detalle;
  const conDiferencia = renglones.filter(difiere);
  const iguala = renglones.filter((r) => r.contado !== null && !resuelto(r) && !difiere(r));
  return (
    <Modal titulo={`Confirmar ${detalle.toma.numero}`} abierto onCerrar={onCancelar}>
      <div className="formulario-modal">
        <ul className="lista-confirmar-toma">
          <li>
            <strong>{conDiferencia.length}</strong> materiales con diferencia: su stock se ajusta a
            lo contado.
          </li>
          <li>
            <strong>{iguala.length}</strong> contados sin diferencia: quedan como están.
          </li>
          {resumen.sinContar > 0 && (
            <li>
              <strong>{resumen.sinContar}</strong> sin contar: <strong>no se tocan</strong>, y la
              toma sigue abierta para seguir contando.
            </li>
          )}
        </ul>
        {conDiferencia.length > 0 && (
          <ul className="texto-chico lista-diferencias">
            {conDiferencia.slice(0, 8).map((r) => (
              <li key={r.id}>
                {r.materialNombre}: figuraba {formatearNumero(r.stockAlContar ?? 0)}, se contaron{' '}
                {formatearNumero(r.contado ?? 0)}
              </li>
            ))}
            {conDiferencia.length > 8 && <li>… y {conDiferencia.length - 8} más.</li>}
          </ul>
        )}
        <p className="texto-suave texto-chico">
          Si algún material se movió después de contarlo (una salida, una entrada), no se ajusta:
          queda para volver a contar, y la toma sigue abierta.
        </p>
        {error && <MensajeError error={error} />}
        <div className="acciones">
          <button type="button" className="btn" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primario"
            disabled={pendiente}
            onClick={onConfirmar}
          >
            {pendiente ? 'Ajustando…' : 'Ajustar el stock'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResultadoDeConfirmar({ resultado }: { resultado: ResultadoConfirmacion }) {
  const cerrada = resultado.toma.estado === 'CERRADA';
  const faltan = resultado.resumen.sinContar;
  return (
    <div className={cerrada ? 'alerta alerta-exito' : 'alerta alerta-aviso'}>
      <p style={{ margin: 0 }}>
        {cerrada ? '✔ Toma cerrada. ' : '✔ Ajustado lo contado. '}
        {resultado.ajustados} ajustados · {resultado.sinDiferencia} sin diferencia
        {resultado.recontar > 0 &&
          ` · ${resultado.recontar} se movieron después de contarlos: volvé a contarlos y confirmá de nuevo`}
        .
        {!cerrada &&
          faltan > 0 &&
          ` Faltan ${faltan} por contar: seguí contando y confirmá de nuevo, o cerrá la toma.`}
      </p>
      {resultado.errores.length > 0 && (
        <ul className="texto-chico">
          {resultado.errores.map((e) => (
            <li key={e.materialNombre}>
              {e.materialNombre}: {e.motivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
