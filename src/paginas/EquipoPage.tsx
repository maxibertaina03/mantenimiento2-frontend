import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useAlmacenDisponible,
  useEquipo,
  useMarcarQrGenerado,
  usePlanesDeEquipo,
  useRepuestos,
} from '@/api/equipos';
import { useManuales } from '@/api/manuales';
import { useOrdenesTrabajo } from '@/api/ordenesTrabajo';
import { ComponentesEquipo } from '@/componentes/ComponentesEquipo';
import { Cargando, MensajeError } from '@/componentes/Estados';
import { FormularioEquipo } from '@/componentes/FormularioEquipo';
import { FotoEquipo } from '@/componentes/FotoEquipo';
import { ManualesEquipo } from '@/componentes/ManualesEquipo';
import { PlanesEquipo, textoVencimiento } from '@/componentes/PlanesEquipo';
import { RegistrarTrabajoEquipo } from '@/componentes/RegistrarTrabajoEquipo';
import { RepuestosEquipo } from '@/componentes/RepuestosEquipo';
import { TrabajosDelEquipo } from '@/componentes/TrabajosDelEquipo';
import { VisorFoto } from '@/componentes/VisorFoto';
import { esCelular } from '@/lib/dispositivo';
import { armarEtiquetas, imprimirEtiquetas } from '@/lib/etiquetaQr';
import { formatearFecha, formatearFechaSola } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { stockDeRepuesto } from '@/lib/stockDeRepuesto';
import { ETIQUETA_ESTADO_EQUIPO, type Equipo, type RepuestoEquipo } from '@/tipos/equipo';

/** Las pestañas de la página, en el orden en que se muestran. */
const PESTANAS = ['resumen', 'repuestos', 'trabajos', 'planes', 'componentes', 'manuales'] as const;
type Pestana = (typeof PESTANAS)[number];

const TITULO: Record<Pestana, string> = {
  resumen: 'Resumen',
  repuestos: 'Repuestos',
  trabajos: 'Trabajos',
  planes: 'Planes',
  componentes: 'Componentes',
  manuales: 'Manuales',
};

/**
 * La página de un equipo: /equipos/:id.
 *
 * Antes era una ventana encima del listado, con todo apilado. Cada cosa nueva
 * la alargaba y en el celular había que bajar mucho para llegar al historial.
 * Ahora tiene su dirección —se comparte y el «atrás» funciona—, arriba lo de
 * todos los días (foto, estado, registrar un trabajo) y el resto en pestañas.
 *
 * La pestaña va en la dirección (?pestana=repuestos) por lo mismo: el «atrás»
 * vuelve a la pestaña anterior y un enlace puede llevar directo a una.
 */
export function EquipoPage() {
  const { id = '' } = useParams();
  const { data: equipo, isLoading, error } = useEquipo(id);

  if (isLoading) return <Cargando />;
  if (error || !equipo) {
    return (
      <div className="panel">
        <h1>No se encontró el equipo</h1>
        <p>
          La dirección o la etiqueta apuntan a un equipo que ya no está en el sistema. Puede que se
          haya borrado, o que la etiqueta sea de otra base de datos.
        </p>
        {error && <MensajeError error={error} />}
        <Link to="/equipos" className="btn btn-primario">
          Ver todos los equipos
        </Link>
      </div>
    );
  }
  // La clave hace que al pasar de un equipo a otro (de la bomba a la máquina
  // donde está montada) no quede nada del anterior: ni formularios abiertos.
  return <PaginaDelEquipo key={equipo.id} equipo={equipo} />;
}

function PaginaDelEquipo({ equipo }: { equipo: Equipo }) {
  const puede = usePuede();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('pestana');
  const pestana: Pestana = PESTANAS.includes(pedida as Pestana) ? (pedida as Pestana) : 'resumen';

  const [registrando, setRegistrando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [avisoQr, setAvisoQr] = useState<string | null>(null);
  const marcarQr = useMarcarQrGenerado();

  /**
   * Entró escaneando la etiqueta pegada en la máquina. En el celular se abre
   * el modo de botones grandes: el que escanea está parado al lado del equipo
   * y quiere hacer algo, no leer la ficha. En la computadora no hace falta.
   */
  const modoRapido = parametros.get('desde') === 'qr' && esCelular();

  /** La etiqueta de este equipo, sola: para reponer una que se despegó o se rompió. */
  const imprimirQr = async () => {
    setAvisoQr(null);
    const etiquetas = await armarEtiquetas([equipo]);
    if (!imprimirEtiquetas(etiquetas)) {
      setAvisoQr(
        'El navegador bloqueó la ventana de impresión. Permitila para este sitio y probá de nuevo.',
      );
      return;
    }
    await marcarQr.mutateAsync([equipo.id]);
  };

  const dadoDeBaja = equipo.estado === 'DADO_DE_BAJA';
  const planes = usePlanesDeEquipo(equipo.id);
  const repuestos = useRepuestos(equipo.id);
  const manuales = useManuales(equipo.id);
  const verTrabajos = puede(P.TRABAJOS_VER);
  // La misma consulta que el historial: se comparte en la caché y no se pide dos veces.
  const trabajos = useOrdenesTrabajo(
    1,
    20,
    { equipoId: equipo.id, incluirComponentes: true },
    verTrabajos,
  );

  const listaPlanes = planes.data ?? [];
  const listaRepuestos = repuestos.data ?? [];
  const planesVencidos = listaPlanes.filter((p) => p.activo && p.estado === 'VENCIDO');
  const planesPorVencer = listaPlanes.filter((p) => p.activo && p.estado === 'POR_VENCER');
  const repuestosQueFaltan = listaRepuestos.filter((r) => {
    const clase = stockDeRepuesto(r).clase;
    return clase === 'sin' || clase === 'bajo';
  });
  const ultimoTrabajo = trabajos.data?.datos[0];

  /** Lo que se cuenta en cada pestaña, y si hay algo para mirar. */
  const contador: Partial<Record<Pestana, { n: number; alerta: boolean }>> = {
    repuestos: { n: listaRepuestos.length, alerta: repuestosQueFaltan.length > 0 },
    trabajos: { n: trabajos.data?.total ?? 0, alerta: false },
    planes: { n: listaPlanes.length, alerta: planesVencidos.length > 0 },
    componentes: { n: equipo.cantidadComponentes, alerta: false },
    manuales: { n: manuales.data?.manuales.length ?? 0, alerta: false },
  };

  const irA = (p: Pestana) => {
    parametros.delete('desde');
    if (p === 'resumen') parametros.delete('pestana');
    else parametros.set('pestana', p);
    setParametros(parametros);
  };

  return (
    <>
      <Link to="/equipos" className="texto-suave volver">
        ← Equipos y herramientas
      </Link>

      {/* ── Encabezado: lo que se mira y lo que se hace todos los días ── */}
      <div className="panel cabecera-equipo">
        {equipo.fotoUrl ? (
          <button
            type="button"
            className="cabecera-equipo-foto-boton"
            title="Tocá para agrandar la foto"
            aria-label={`Ver la foto de ${equipo.nombre}`}
            onClick={() => setFotoAmpliada(true)}
          >
            <img src={equipo.fotoUrl} alt="" className="cabecera-equipo-foto" />
          </button>
        ) : (
          <span className="cabecera-equipo-foto cabecera-equipo-foto-vacia" aria-hidden="true">
            Sin foto
          </span>
        )}
        <div className="cabecera-equipo-datos">
          <h1>{equipo.nombre}</h1>
          <div className="cabecera-equipo-linea">
            <span className={`etiqueta estado-${equipo.estado.toLowerCase()}`}>
              {ETIQUETA_ESTADO_EQUIPO[equipo.estado]}
            </span>
            {[equipo.ubicacionNombre, equipo.tipoNombre, equipo.codigoInterno]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {equipo.equipoPadreId && (
            <div className="texto-chico">
              Montado en{' '}
              <Link to={`/equipos/${equipo.equipoPadreId}`}>{equipo.equipoPadreNombre}</Link>
            </div>
          )}
        </div>
        {/* En el modo rápido las acciones son los botones grandes de abajo. */}
        {!modoRapido && (
        <div className="cabecera-equipo-acciones">
          {!dadoDeBaja && puede(P.TRABAJOS_EDITAR) && (
            <button type="button" className="btn btn-primario" onClick={() => setRegistrando(true)}>
              + Registrar trabajo
            </button>
          )}
          {puede(P.EQUIPOS_EDITAR) && (
            <button type="button" className="btn" onClick={() => setEditando(true)}>
              ✎ Editar
            </button>
          )}
          {puede(P.EQUIPOS_EDITAR) && (
            <button
              type="button"
              className="btn"
              title="Imprimir la etiqueta con el QR de este equipo"
              disabled={marcarQr.isPending}
              onClick={imprimirQr}
            >
              🏷 Etiqueta QR
            </button>
          )}
        </div>
        )}
      </div>
      {avisoQr && <p className="aviso-escaneo es-error">{avisoQr}</p>}

      {modoRapido && (
        <ModoRapido
          puedeRegistrar={!dadoDeBaja && puede(P.TRABAJOS_EDITAR)}
          verTrabajos={verTrabajos}
          vencidos={planesVencidos}
          faltan={repuestosQueFaltan}
          onRegistrar={() => setRegistrando(true)}
          onIr={irA}
        />
      )}

      {/* ── Pestañas ── */}
      {!modoRapido && (
      <>
      <div className="pestanas-equipo" role="tablist" aria-label="Secciones del equipo">
        {PESTANAS.filter((p) => p !== 'trabajos' || verTrabajos).map((p) => {
          const c = contador[p];
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pestana === p}
              className={pestana === p ? 'pestana-equipo activa' : 'pestana-equipo'}
              onClick={() => irA(p)}
            >
              {TITULO[p]}
              {c && c.n > 0 && (
                <span className={c.alerta ? 'contador-pestana contador-pestana-alerta' : 'contador-pestana'}>
                  {c.n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="panel" role="tabpanel">
        {pestana === 'resumen' && (
          <Resumen
            equipo={equipo}
            vencidos={planesVencidos}
            porVencer={planesPorVencer}
            faltan={repuestosQueFaltan}
            ultimoTrabajo={
              ultimoTrabajo
                ? {
                    numero: ultimoTrabajo.numero,
                    titulo: ultimoTrabajo.titulo,
                    fecha: ultimoTrabajo.fecha,
                  }
                : null
            }
            onIr={irA}
          />
        )}
        {pestana === 'repuestos' && <RepuestosEquipo equipo={equipo} />}
        {pestana === 'trabajos' && (
          <TrabajosDelEquipo
            equipoId={equipo.id}
            equipoNombre={equipo.nombre}
            planes={listaPlanes.map((p) => ({ id: p.id, nombre: p.nombre }))}
            permiteNuevos={!dadoDeBaja}
          />
        )}
        {pestana === 'planes' && <PlanesEquipo equipo={equipo} />}
        {pestana === 'componentes' && (
          <ComponentesEquipo equipo={equipo} onAbrir={(otro) => navegar(`/equipos/${otro}`)} />
        )}
        {pestana === 'manuales' && <ManualesEquipo equipoId={equipo.id} />}
      </div>
      </>
      )}

      {registrando && (
        <RegistrarTrabajoEquipo
          equipoId={equipo.id}
          equipoNombre={equipo.nombre}
          planes={listaPlanes.map((p) => ({ id: p.id, nombre: p.nombre }))}
          onCerrar={() => setRegistrando(false)}
        />
      )}
      {editando && <FormularioEquipo equipo={equipo} alCerrar={() => setEditando(false)} />}
      {fotoAmpliada && equipo.fotoUrl && (
        <VisorFoto url={equipo.fotoUrl} titulo={equipo.nombre} alCerrar={() => setFotoAmpliada(false)} />
      )}
    </>
  );
}

/**
 * «Al pie de la máquina»: lo que ve en el celular quien escanea la etiqueta.
 *
 * Cuatro botones grandes con lo que se hace ahí mismo —fáciles con guantes o
 * con las manos sucias— y abajo lo urgente de esa máquina. La ficha completa
 * queda a un toque.
 */
function ModoRapido({
  puedeRegistrar,
  verTrabajos,
  vencidos,
  faltan,
  onRegistrar,
  onIr,
}: {
  puedeRegistrar: boolean;
  verTrabajos: boolean;
  vencidos: PlanParaMirar[];
  faltan: RepuestoEquipo[];
  onRegistrar: () => void;
  onIr: (p: Pestana) => void;
}) {
  return (
    <div className="modo-rapido">
      <div className="acciones-grandes">
        {puedeRegistrar && (
          <button type="button" className="accion-grande accion-grande-principal" onClick={onRegistrar}>
            <span aria-hidden="true">＋</span>
            Registrar trabajo
          </button>
        )}
        <button type="button" className="accion-grande" onClick={() => onIr('repuestos')}>
          <span aria-hidden="true">⚙</span>
          Repuestos
        </button>
        {verTrabajos && (
          <button type="button" className="accion-grande" onClick={() => onIr('trabajos')}>
            <span aria-hidden="true">☰</span>
            Historial
          </button>
        )}
        <button type="button" className="accion-grande" onClick={() => onIr('manuales')}>
          <span aria-hidden="true">▤</span>
          Manuales
        </button>
      </div>

      {(vencidos.length > 0 || faltan.length > 0) && (
        <ul className="lista-mirar">
          {vencidos.map((p) => (
            <li key={p.id}>
              <button type="button" className="renglon-mirar" onClick={() => onIr('planes')}>
                <span>Service «{p.nombre}»</span>
                <span className="chip-stock chip-stock-sin">{textoVencimiento(p.diasParaVencer)}</span>
              </button>
            </li>
          ))}
          {faltan.map((r) => {
            const stock = stockDeRepuesto(r);
            return (
              <li key={r.id}>
                <button type="button" className="renglon-mirar" onClick={() => onIr('repuestos')}>
                  <span>{r.materialNombre}</span>
                  <span className={`chip-stock chip-stock-${stock.clase}`}>{stock.texto}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="btn ver-ficha-completa" onClick={() => onIr('resumen')}>
        Ver ficha completa ›
      </button>
    </div>
  );
}

interface PlanParaMirar {
  id: string;
  nombre: string;
  diasParaVencer: number;
}

/**
 * La primera pestaña: los datos de la máquina y lo que hay que mirar.
 *
 * «Lo que hay que mirar» junta lo urgente que antes estaba repartido en tres
 * secciones: services vencidos, repuestos que no hay o no alcanzan, y el
 * último trabajo. Cada renglón lleva a su pestaña.
 */
function Resumen({
  equipo,
  vencidos,
  porVencer,
  faltan,
  ultimoTrabajo,
  onIr,
}: {
  equipo: Equipo;
  vencidos: PlanParaMirar[];
  porVencer: PlanParaMirar[];
  faltan: RepuestoEquipo[];
  ultimoTrabajo: { numero: string; titulo: string; fecha: string } | null;
  onIr: (p: Pestana) => void;
}) {
  // Si el servidor no tiene almacén, no se ofrece cargar fotos: prometer algo
  // que va a fallar es peor que no ofrecerlo.
  const almacen = useAlmacenDisponible();
  const nadaPendiente = vencidos.length === 0 && porVencer.length === 0 && faltan.length === 0;

  const dato = (etiqueta: string, valor: string | null | undefined) => (
    <div className="dato">
      <span className="texto-suave texto-chico">{etiqueta}</span>
      <span>{valor || '—'}</span>
    </div>
  );

  return (
    <div className="resumen-equipo">
      <section className="resumen-mirar" aria-labelledby="titulo-mirar">
        <h2 id="titulo-mirar" className="subtitulo-form">
          Lo que hay que mirar
        </h2>
        {nadaPendiente ? (
          <p className="texto-suave">Todo en orden: ningún service vencido ni repuestos que falten.</p>
        ) : (
          <ul className="lista-mirar">
            {vencidos.map((p) => (
              <li key={p.id}>
                <button type="button" className="renglon-mirar" onClick={() => onIr('planes')}>
                  <span>Service «{p.nombre}»</span>
                  <span className="chip-stock chip-stock-sin">{textoVencimiento(p.diasParaVencer)}</span>
                </button>
              </li>
            ))}
            {porVencer.map((p) => (
              <li key={p.id}>
                <button type="button" className="renglon-mirar" onClick={() => onIr('planes')}>
                  <span>Service «{p.nombre}»</span>
                  <span className="chip-stock chip-stock-bajo">{textoVencimiento(p.diasParaVencer)}</span>
                </button>
              </li>
            ))}
            {faltan.map((r) => {
              const stock = stockDeRepuesto(r);
              return (
                <li key={r.id}>
                  <button type="button" className="renglon-mirar" onClick={() => onIr('repuestos')}>
                    <span>{r.materialNombre}</span>
                    <span className={`chip-stock chip-stock-${stock.clase}`}>{stock.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {ultimoTrabajo && (
          <button type="button" className="ultimo-trabajo" onClick={() => onIr('trabajos')}>
            <span className="texto-suave texto-chico">Último trabajo</span>
            <span>
              <strong>{ultimoTrabajo.numero}</strong> · {ultimoTrabajo.titulo}
            </span>
            <span className="texto-suave texto-chico">{formatearFecha(ultimoTrabajo.fecha)}</span>
          </button>
        )}
      </section>

      <section aria-labelledby="titulo-datos">
        <h2 id="titulo-datos" className="subtitulo-form">
          Datos
        </h2>
        <div className="grilla-datos">
          {dato('Código', equipo.codigoInterno)}
          {dato('Ubicación', equipo.ubicacionNombre)}
          {dato('Tipo', equipo.tipoNombre)}
          {dato('Marca', equipo.marcaNombre)}
          {dato('Modelo', equipo.modeloNombre)}
          {dato('N° de serie', equipo.numeroSerie)}
          {dato('Proveedor', equipo.proveedorNombre)}
          {dato('Horas de uso', equipo.horasUso === null ? null : String(equipo.horasUso))}
          {dato('Alta', equipo.fechaAlta ? formatearFechaSola(equipo.fechaAlta) : null)}
          {dato(
            'Garantía',
            equipo.garantiaHasta
              ? `${formatearFechaSola(equipo.garantiaHasta)}${equipo.garantiaVencida ? ' · vencida' : ''}`
              : null,
          )}
          {dato('Etiqueta QR', equipo.qrGeneradoEn ? 'Impresa' : 'Sin imprimir')}
        </div>
        {equipo.descripcion && (
          <div>
            <span className="texto-suave texto-chico">Descripción</span>
            <p>{equipo.descripcion}</p>
          </div>
        )}
        {almacen.data?.disponible && <FotoEquipo equipo={equipo} />}
      </section>
    </div>
  );
}
