import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMaterialConHistorial } from '@/api/materiales';
import { BadgeMovimiento } from '@/componentes/BadgeMovimiento';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFecha, formatearNumero } from '@/lib/formato';

export function MaterialDetallePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: material, isLoading, error } = useMaterialConHistorial(id);

  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!material) return null;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <Link to="/materiales" className="texto-suave">
            ← Volver a materiales
          </Link>
          <h1 style={{ marginTop: '0.4rem' }}>{material.nombre}</h1>
        </div>
        <button
          className="btn btn-primario"
          onClick={() => navigate(`/movimientos/nuevo?materialId=${material.id}`)}
        >
          + Registrar movimiento
        </button>
      </div>

      <div className="panel">
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
              Stock mínimo
            </p>
            <p style={{ marginTop: '0.2rem' }}>{formatearNumero(material.stockMinimo)}</p>
          </div>
        </div>
        {material.notas && (
          <p className="texto-suave" style={{ marginBottom: 0 }}>
            Notas: {material.notas}
          </p>
        )}
      </div>

      <h2>Historial de movimientos</h2>
      {material.movimientos.length === 0 ? (
        <EstadoVacio>Este material no tiene movimientos todavía.</EstadoVacio>
      ) : (
        <div className="tabla-scroll">
        <table className="tabla">
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
                <td>{formatearFecha(m.fecha)}</td>
                <td>
                  <BadgeMovimiento tipo={m.tipo} />
                </td>
                <td>{m.motivo}</td>
                <td className="num">{formatearNumero(m.cantidad)}</td>
                <td>{m.referenciaTrabajo ?? '—'}</td>
                <td>{m.notas ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
