import { useState } from 'react';
import {
  useActualizarItemCatalogo,
  useActualizarModelo,
  useCatalogoEquipos,
  useCrearItemCatalogo,
  useCrearModelo,
  useEliminarItemCatalogo,
  useEliminarModelo,
  useTodosLosModelos,
  type ItemCatalogoEquipo,
  type ModeloEquipo,
} from '@/api/catalogosEquipo';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';

type Solapa = 'ubicaciones' | 'tipos' | 'marcas' | 'modelos';

const SOLAPAS: { clave: Solapa; texto: string }[] = [
  { clave: 'ubicaciones', texto: 'Sectores' },
  { clave: 'tipos', texto: 'Tipos' },
  { clave: 'marcas', texto: 'Marcas' },
  { clave: 'modelos', texto: 'Modelos' },
];

/**
 * Las listas de las que salen los desplegables de la ficha del equipo.
 *
 * Existen para que estos datos no sean texto libre. Escritos a mano,
 * "Grundfos", "GRUNDFOS" y "grundfos" son tres marcas distintas para cualquier
 * reporte, y la pregunta "cuántas bombas Grundfos tenemos" deja de tener una
 * respuesta.
 *
 * Los cuatro van juntos en una sola pantalla porque se cargan juntos: quien
 * está dando de alta un equipo nuevo suele encontrarse con que le falta el
 * sector, el tipo y la marca al mismo tiempo.
 */
export function CatalogosEquipo({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [solapa, setSolapa] = useState<Solapa>('tipos');

  return (
    <Modal titulo="Listas de equipos" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <div className="solapas" role="tablist">
          {SOLAPAS.map((s) => (
            <button
              key={s.clave}
              role="tab"
              aria-selected={solapa === s.clave}
              className={solapa === s.clave ? 'solapa activa' : 'solapa'}
              onClick={() => setSolapa(s.clave)}
            >
              {s.texto}
            </button>
          ))}
        </div>

        {solapa === 'ubicaciones' && (
          <ListaSimple
            catalogo="ubicaciones-equipo"
            que="sector"
            ejemplo="Caldera"
            ayuda="Dónde está la máquina dentro de la planta."
          />
        )}
        {solapa === 'tipos' && (
          <ListaSimple
            catalogo="tipos-equipo-planta"
            que="tipo"
            ejemplo="Bomba"
            ayuda="Qué clase de máquina es. Sirve para preguntar después cuántas bombas hay y cuánto cuestan."
          />
        )}
        {solapa === 'marcas' && (
          <ListaSimple
            catalogo="marcas-equipo"
            que="marca"
            ejemplo="Grundfos"
            ayuda="Cada marca puede tener sus modelos, que se cargan en la solapa de al lado."
          />
        )}
        {solapa === 'modelos' && <ListaModelos />}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Los tres catálogos que son solo un nombre. */
function ListaSimple({
  catalogo,
  que,
  ejemplo,
  ayuda,
}: {
  catalogo: 'ubicaciones-equipo' | 'tipos-equipo-planta' | 'marcas-equipo';
  que: string;
  ejemplo: string;
  ayuda: string;
}) {
  const catalogos = useCatalogoEquipos();
  const consulta =
    catalogo === 'ubicaciones-equipo'
      ? catalogos.ubicaciones
      : catalogo === 'tipos-equipo-planta'
        ? catalogos.tipos
        : catalogos.marcas;

  const crear = useCrearItemCatalogo(catalogo);
  const actualizar = useActualizarItemCatalogo(catalogo);
  const eliminar = useEliminarItemCatalogo(catalogo);
  const [nombre, setNombre] = useState('');

  const agregar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    await crear.mutateAsync({ nombre: limpio });
    setNombre('');
  };

  const borrar = async (item: ItemCatalogoEquipo) => {
    if (!confirm(`¿Eliminar ${que} "${item.nombre}"?`)) return;
    await eliminar.mutateAsync(item.id);
  };

  if (consulta.isLoading) return <Cargando />;
  if (consulta.error) return <MensajeError error={consulta.error} />;
  const items = consulta.data ?? [];

  return (
    <>
      <p className="texto-suave texto-chico">{ayuda}</p>

      <div className="alta-rapida">
        <input
          value={nombre}
          placeholder={`Nuevo ${que}. Por ejemplo: ${ejemplo}`}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void agregar();
            }
          }}
        />
        <button className="btn btn-primario" onClick={agregar} disabled={!nombre.trim() || crear.isPending}>
          {crear.isPending ? 'Agregando…' : '+ Agregar'}
        </button>
      </div>

      {crear.error && <MensajeError error={crear.error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}

      {items.length === 0 ? (
        <EstadoVacio>Todavía no hay ningún {que} cargado.</EstadoVacio>
      ) : (
        <ul className="lista-catalogo">
          {items.map((item) => (
            <li key={item.id} className={item.activo ? undefined : 'inactivo'}>
              <span>
                {item.nombre}
                {!item.activo && <span className="texto-suave texto-chico"> · desactivado</span>}
              </span>
              <span className="acciones-catalogo">
                <span className="texto-suave texto-chico">
                  {item.equipos === 0 ? 'sin uso' : `${item.equipos} equipo(s)`}
                </span>
                <button
                  className="btn btn-chico"
                  onClick={() => actualizar.mutate({ id: item.id, activo: !item.activo })}
                >
                  {item.activo ? 'Desactivar' : 'Activar'}
                </button>
                {/* Solo se borra lo que nadie usa: si está en uso, lo correcto
                    es desactivarlo, que lo saca de los desplegables sin tocar
                    los equipos que ya lo tienen. */}
                {item.equipos === 0 && (
                  <button className="btn btn-chico" onClick={() => borrar(item)}>
                    Eliminar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Los modelos, que cuelgan de una marca. */
function ListaModelos() {
  const { marcas } = useCatalogoEquipos();
  const modelos = useTodosLosModelos();
  const crear = useCrearModelo();
  const actualizar = useActualizarModelo();
  const eliminar = useEliminarModelo();

  const [marcaId, setMarcaId] = useState('');
  const [nombre, setNombre] = useState('');

  const agregar = async () => {
    const limpio = nombre.trim();
    if (!limpio || !marcaId) return;
    await crear.mutateAsync({ marcaId, nombre: limpio });
    setNombre('');
  };

  const borrar = async (m: ModeloEquipo) => {
    if (!confirm(`¿Eliminar el modelo "${m.nombre}" de ${m.marcaNombre}?`)) return;
    await eliminar.mutateAsync(m.id);
  };

  if (marcas.isLoading || modelos.isLoading) return <Cargando />;
  if (marcas.error) return <MensajeError error={marcas.error} />;

  const listaMarcas = marcas.data ?? [];
  const lista = modelos.data ?? [];

  if (listaMarcas.length === 0) {
    return (
      <EstadoVacio>
        Un modelo siempre pertenece a una marca, así que primero hay que cargar la marca en la
        solapa de al lado.
      </EstadoVacio>
    );
  }

  return (
    <>
      <p className="texto-suave texto-chico">
        Un modelo pertenece a una marca: un «5030» de Grundfos no es el mismo que uno de Siemens.
        Por eso el nombre puede repetirse entre marcas distintas, pero no dentro de la misma.
      </p>

      <div className="alta-rapida">
        <select value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
          <option value="">Marca…</option>
          {listaMarcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <input
          value={nombre}
          placeholder="Nuevo modelo. Por ejemplo: CR 5-10"
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void agregar();
            }
          }}
        />
        <button
          className="btn btn-primario"
          onClick={agregar}
          disabled={!nombre.trim() || !marcaId || crear.isPending}
          title={marcaId ? undefined : 'Elegí primero la marca'}
        >
          {crear.isPending ? 'Agregando…' : '+ Agregar'}
        </button>
      </div>

      {crear.error && <MensajeError error={crear.error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}

      {lista.length === 0 ? (
        <EstadoVacio>Todavía no hay ningún modelo cargado.</EstadoVacio>
      ) : (
        <ul className="lista-catalogo">
          {lista.map((m) => (
            <li key={m.id} className={m.activo ? undefined : 'inactivo'}>
              <span>
                <span className="texto-suave">{m.marcaNombre} · </span>
                {m.nombre}
                {!m.activo && <span className="texto-suave texto-chico"> · desactivado</span>}
              </span>
              <span className="acciones-catalogo">
                <span className="texto-suave texto-chico">
                  {m.equipos === 0 ? 'sin uso' : `${m.equipos} equipo(s)`}
                </span>
                <button
                  className="btn btn-chico"
                  onClick={() => actualizar.mutate({ id: m.id, activo: !m.activo })}
                >
                  {m.activo ? 'Desactivar' : 'Activar'}
                </button>
                {m.equipos === 0 && (
                  <button className="btn btn-chico" onClick={() => borrar(m)}>
                    Eliminar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
