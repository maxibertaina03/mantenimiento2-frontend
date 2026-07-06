import { useEffect, useState } from 'react';
import {
  useActualizarProveedor,
  useCrearProveedor,
  useEliminarProveedor,
  useProveedores,
} from '@/api/proveedores';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
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
        <div className="tabla-scroll">
        <table className="tabla">
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
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.cuit ?? '—'}</td>
                <td>{p.email ?? '—'}</td>
                <td>{p.telefono ?? '—'}</td>
                <td>
                  <div className="fila-acciones">
                    <button className="btn btn-sm" onClick={() => abrirEdicion(p)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-peligro" onClick={() => borrar(p)}>
                      Eliminar
                    </button>
                  </div>
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
