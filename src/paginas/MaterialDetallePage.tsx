import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActualizarMaterial, useMaterialConHistorial } from '@/api/materiales';
import { BadgeMovimiento } from '@/componentes/BadgeMovimiento';
import { EquiposDeMaterial } from '@/componentes/EquiposDeMaterial';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { FormularioMaterial } from '@/componentes/FormularioMaterial';
import { FotoMaterial } from '@/componentes/FotoMaterial';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearFechaSola, formatearNumero } from '@/lib/formato';
import { useVolverA } from '@/lib/listaEnUrl';
import { P, usePuede } from '@/lib/permisos';
import type { UltimoInventario } from '@/tipos/material';

/** «hoy», «ayer», «hace 12 días»: para ver de un vistazo si está fresco. */
function haceCuanto(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/**
 * La última vez que se contó: en una toma (con enlace, si se la puede ver) o
 * con un ajuste a mano.
 */
function UltimoInventarioDato({
  ultimo,
  unidad,
}: {
  ultimo: UltimoInventario | null;
  unidad: string;
}) {
  const puede = usePuede();
  if (!ultimo) return <p style={{ marginTop: '0.2rem' }}>Nunca se contó</p>;

  const por = ultimo.porNombre ? ` · ${ultimo.porNombre}` : '';
  let detalle: string;
  if (ultimo.origen === 'AJUSTE') {
    detalle = `Ajuste a mano a ${formatearNumero(ultimo.contado)} ${unidad}${por}`;
  } else if (ultimo.resultado === 'SIN_DIFERENCIA') {
    detalle = `Se contaron ${formatearNumero(ultimo.contado)} ${unidad}, sin diferencia${por}`;
  } else {
    detalle =
      `Se contaron ${formatearNumero(ultimo.contado)} ${unidad}` +
      (ultimo.figuraba !== null ? `, figuraban ${formatearNumero(ultimo.figuraba)}` : '') +
      ` · se ajustó${por}`;
  }

  return (
    <>
      <p style={{ marginTop: '0.2rem', marginBottom: 0 }}>
        {formatearFechaSola(ultimo.fecha)}{' '}
        <span className="texto-suave">({haceCuanto(ultimo.fecha)})</span>
        {ultimo.origen === 'TOMA' && ultimo.tomaId && (
          <>
            {' · '}
            {puede(P.INVENTARIO_VER) ? (
              <Link to={`/inventario/${ultimo.tomaId}`}>{ultimo.tomaNumero}</Link>
            ) : (
              ultimo.tomaNumero
            )}
          </>
        )}
      </p>
      <p className="texto-suave texto-chico" style={{ marginTop: '0.1rem' }}>
        {detalle}
      </p>
    </>
  );
}

export function MaterialDetallePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  // La lista como estaba al entrar (filtro, búsqueda, página), o la lista sola.
  const volverA = useVolverA('/materiales');
  const { data: material, isLoading, error } = useMaterialConHistorial(id);
  const actualizar = useActualizarMaterial(id);
  // La ficha es a donde cae quien escanea el QR del estante: desde acá tiene
  // que poder corregir lo que ve, sin volver al listado a buscarlo.
  const [editando, setEditando] = useState(false);

  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!material) return null;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <Link to={volverA} className="texto-suave">
            ← Volver a materiales
          </Link>
          <h1 style={{ marginTop: '0.4rem' }}>{material.nombre}</h1>
        </div>
        <div className="acciones-cabecera">
          {material.activo && (
            <button
              className="btn btn-primario"
              onClick={() => navigate(`/movimientos/nuevo?materialId=${material.id}`)}
            >
              + Registrar movimiento
            </button>
          )}
          <button className="btn" onClick={() => setEditando(true)}>
            ✎ Editar
          </button>
          <button
            className="btn"
            disabled={actualizar.isPending}
            onClick={() => actualizar.mutate({ activo: !material.activo })}
          >
            {material.activo ? 'Sacar de circulación' : 'Volver a poner en uso'}
          </button>
        </div>
      </div>

      {!material.activo && (
        <div className="panel panel-aviso">
          <b>Este material está fuera de circulación.</b> No se puede usar en movimientos ni
          en órdenes de compra nuevas. Su historial se conserva entero y se puede volver a
          poner en uso cuando haga falta.
        </div>
      )}

      {actualizar.error && <MensajeError error={actualizar.error} />}

      <div className="panel ficha-material">
        <div className="grilla-2">
          <div>
            <p className="texto-suave" style={{ margin: 0 }}>
              Categoría
            </p>
            <p style={{ marginTop: '0.2rem' }}>{material.categoriaNombre ?? '—'}</p>
          </div>
          <div>
            <p className="texto-suave" style={{ margin: 0 }}>
              Unidad
            </p>
            <p style={{ marginTop: '0.2rem' }}>{material.unidad}</p>
          </div>
          <div>
            <p className="texto-suave" style={{ margin: 0 }}>
              Stock actual
            </p>
            <p style={{ marginTop: '0.2rem', fontSize: '1.4rem', fontWeight: 700 }}>
              {formatearNumero(material.stockActual)} {material.unidad}{' '}
              {material.bajoStock && <span className="badge badge-bajo">Bajo stock</span>}
            </p>
          </div>
          <div>
            <p className="texto-suave" style={{ margin: 0 }}>
              Dónde está
            </p>
            <p style={{ marginTop: '0.2rem' }}>
              {material.estanteriaNombre
                ? `${material.estanteriaNombre}${material.fila ? ` · fila ${material.fila}` : ''}`
                : 'Sin ubicar'}
            </p>
          </div>
          <div>
            <p className="texto-suave" style={{ margin: 0 }}>
              Stock mínimo
            </p>
            <p style={{ marginTop: '0.2rem' }}>{formatearNumero(material.stockMinimo)}</p>
          </div>
          <div>
            <p className="texto-suave" style={{ margin: 0 }}>
              Último inventario
            </p>
            <UltimoInventarioDato ultimo={material.ultimoInventario} unidad={material.unidad} />
          </div>
          {material.notas && (
            <p className="texto-suave" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              Notas: {material.notas}
            </p>
          )}
        </div>
        <FotoMaterial material={material} />
      </div>

      <EquiposDeMaterial materialId={material.id} unidad={material.unidad} />

      <h2>Historial de movimientos</h2>
      {material.movimientos.length === 0 ? (
        <EstadoVacio>Este material no tiene movimientos todavía.</EstadoVacio>
      ) : (
        <div className="tabla-scroll tabla-cards-contenedor">
        <table className="tabla tabla-cards">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th className="num">Cantidad</th>
              <th>Referencia</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {material.movimientos.map((m) => (
              <tr key={m.id}>
                <td data-etiqueta="Fecha">{formatearFecha(m.fecha)}</td>
                <td data-etiqueta="Tipo">
                  <BadgeMovimiento tipo={m.tipo} />
                </td>
                <td data-etiqueta="Motivo">{m.motivo}</td>
                <td className="num" data-etiqueta="Cantidad">
                  {formatearNumero(m.cantidad)}
                </td>
                <td data-etiqueta="Referencia">{m.referenciaTrabajo ?? '—'}</td>
                <td data-etiqueta="Notas">{m.notas ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {editando && (
        <Modal titulo={`Editar ${material.nombre}`} abierto onCerrar={() => setEditando(false)}>
          <FormularioMaterial material={material} onListo={() => setEditando(false)} />
        </Modal>
      )}
    </>
  );
}
