import { useEffect, useState } from 'react';
import {
  useActualizarProveedor,
  useCrearProveedor,
  useEliminarProveedor,
  useProveedores,
} from '@/api/proveedores';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { AccionesFila, DatoFicha } from '@/componentes/AccionesFila';
import { Modal } from '@/componentes/Modal';
import type { CrearProveedorInput, Proveedor } from '@/tipos/proveedor';

const FORM_VACIO: CrearProveedorInput = { nombre: '', cuit: '', email: '', telefono: '', notas: '' };
const LIMITE = 20;

export function ProveedoresPage() {
  const [buscar, setBuscar] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, error, isFetching } = useProveedores(pagina, LIMITE, busquedaDebounced);
  const eliminar = useEliminarProveedor();
  const [edicion, setEdicion] = useState<Proveedor | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Proveedor | null>(null);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  const abrirNuevo = () => {
    setEdicion(null);
    setModalAbierto(true);
  };
  const abrirEdicion = (p: Proveedor) => {
    setEdicion(p);
    setModalAbierto(true);
  };

  const borrar = (p: Proveedor) => {
    if (confirm(`¿Eliminar el proveedor "${p.nombre}"?`)) {
      eliminar.mutate(p.id);
    }
  };

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Proveedores</h1>
        <button className="btn btn-primario" onClick={abrirNuevo}>
          + Nuevo proveedor
        </button>
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="🔍 Buscar proveedor por nombre o CUIT…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          autoFocus
        />
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}

      {data && (
        <div className="tabla-scroll tabla-cards-contenedor">
        <table className="tabla tabla-cards">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.datos.map((p) => (
              <tr key={p.id} className="fila-clickeable" onClick={() => setDetalle(p)}>
                <td data-etiqueta="Nombre">{p.nombre}</td>
                <td data-etiqueta="CUIT">{p.cuit ?? '—'}</td>
                <td data-etiqueta="Email">{p.email ?? '—'}</td>
                <td data-etiqueta="Teléfono">{p.telefono ?? '—'}</td>
                {/* stopPropagation: los botones no deben abrir la ficha. */}
                <td className="celda-acciones" onClick={(e) => e.stopPropagation()}>
                  <AccionesFila
                    descripcion={p.nombre}
                    onVer={() => setDetalle(p)}
                    onEditar={() => abrirEdicion(p)}
                    onEliminar={() => borrar(p)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busquedaDebounced
            ? `No se encontraron proveedores para «${busquedaDebounced}».`
            : 'No hay proveedores cargados todavía.'}
        </EstadoVacio>
      )}

      {data && data.total > LIMITE && (
        <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="texto-suave">{data.total} proveedor(es)</span>
          <div className="fila-acciones">
            <button
              className="btn btn-sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              ← Anterior
            </button>
            <span className="texto-suave" style={{ padding: '0 0.5rem' }}>
              Página {pagina} de {totalPaginas}
            </span>
            <button
              className="btn btn-sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      <Modal
        titulo={detalle?.nombre ?? ''}
        abierto={detalle !== null}
        onCerrar={() => setDetalle(null)}
      >
        {detalle && (
          <div className="formulario-modal">
            <div className="grilla-datos">
              <DatoFicha etiqueta="Nombre" valor={detalle.nombre} />
              <DatoFicha etiqueta="CUIT" valor={detalle.cuit} />
              <DatoFicha etiqueta="Email" valor={detalle.email} />
              <DatoFicha etiqueta="Teléfono" valor={detalle.telefono} />
            </div>
            {detalle.notas && (
              <>
                <h3 className="subtitulo-form">Notas</h3>
                <p className="texto-suave">{detalle.notas}</p>
              </>
            )}
            {!detalle.cuit && !detalle.email && !detalle.telefono && !detalle.notas && (
              <p className="texto-suave">
                Solo tiene cargado el nombre. Tocá «Editar» para completar los datos.
              </p>
            )}
            <div className="acciones">
              <button
                className="btn btn-peligro"
                onClick={() => {
                  const p = detalle;
                  setDetalle(null);
                  borrar(p);
                }}
              >
                Eliminar
              </button>
              <button
                className="btn btn-primario"
                onClick={() => {
                  const p = detalle;
                  setDetalle(null);
                  abrirEdicion(p);
                }}
              >
                Editar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        titulo={edicion ? 'Editar proveedor' : 'Nuevo proveedor'}
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
      >
        <FormularioProveedor proveedor={edicion} onListo={() => setModalAbierto(false)} />
      </Modal>
    </>
  );
}

function FormularioProveedor({
  proveedor,
  onListo,
}: {
  proveedor: Proveedor | null;
  onListo: () => void;
}) {
  const crear = useCrearProveedor();
  const actualizar = useActualizarProveedor();
  const [form, setForm] = useState<CrearProveedorInput>(
    proveedor
      ? {
          nombre: proveedor.nombre,
          cuit: proveedor.cuit ?? '',
          email: proveedor.email ?? '',
          telefono: proveedor.telefono ?? '',
          notas: proveedor.notas ?? '',
        }
      : FORM_VACIO,
  );

  const guardando = crear.isPending || actualizar.isPending;
  const errorMutacion = crear.error ?? actualizar.error;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    // Normalizamos vacíos a undefined para no mandar strings vacíos.
    const payload: CrearProveedorInput = {
      nombre: form.nombre,
      cuit: form.cuit || undefined,
      email: form.email || undefined,
      telefono: form.telefono || undefined,
      notas: form.notas || undefined,
    };
    if (proveedor) {
      actualizar.mutate({ id: proveedor.id, input: payload }, { onSuccess: onListo });
    } else {
      crear.mutate(payload, { onSuccess: onListo });
    }
  };

  return (
    <form onSubmit={enviar}>
      {errorMutacion && <MensajeError error={errorMutacion} />}

      <div className="campo">
        <label>Nombre</label>
        <input
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
      </div>
      <div className="grilla-2">
        <div className="campo">
          <label>CUIT</label>
          <input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
        </div>
        <div className="campo">
          <label>Teléfono</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
        </div>
      </div>
      <div className="campo">
        <label>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="campo">
        <label>Notas</label>
        <textarea
          rows={2}
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
        />
      </div>

      <div className="acciones">
        <button type="button" className="btn" onClick={onListo}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : proveedor ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </form>
  );
}
