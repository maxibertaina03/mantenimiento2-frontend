import { useAsignacionesEquipo, useEliminarEquipo } from '@/api/equiposIt';
import { CredencialesDelEquipo } from '@/componentes/CredencialesDelEquipo';
import { TrabajosDelEquipo } from '@/componentes/TrabajosDelEquipo';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { formatearFecha, formatearFechaSola } from '@/lib/formato';
import { ETIQUETA_ACCESO, ETIQUETA_ESTADO } from '@/tipos/equipoIt';
import type { EquipoIt } from '@/tipos/equipoIt';
import { nombreDelEquipo } from './comun';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null }) {
  if (valor === null || valor === '' || valor === undefined) return null;
  return (
    <div className="dato">
      <span className="texto-suave texto-chico">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}

export function ModalDetalleEquipo({
  equipo,
  alCerrar,
  alEditar,
}: {
  equipo: EquipoIt;
  alCerrar: () => void;
  alEditar: () => void;
}) {
  const { data: historial } = useAsignacionesEquipo(equipo.id);
  const eliminar = useEliminarEquipo();

  return (
    <Modal titulo={nombreDelEquipo(equipo)} abierto tamano="ancho" onCerrar={alCerrar}>
      <div className="formulario-modal">
        <div className="grilla-datos">
          <Dato etiqueta="Código interno" valor={equipo.codigoInterno} />
          <Dato etiqueta="Tipo" valor={equipo.tipoNombre} />
          <Dato etiqueta="Estado" valor={ETIQUETA_ESTADO[equipo.estado]} />
          <Dato etiqueta="Nº de serie" valor={equipo.numeroSerie} />
          <Dato etiqueta="Marca" valor={equipo.marcaNombre} />
          <Dato etiqueta="Modelo" valor={equipo.modeloNombre} />
          <Dato etiqueta="Ubicación" valor={equipo.ubicacionNombre} />
          <Dato etiqueta="Responsable" valor={equipo.responsableNombre ?? 'Depósito'} />
        </div>

        {(equipo.procesador || equipo.memoriaRamGb || equipo.discoCapacidadGb) && (
          <>
            <h3 className="subtitulo-form">Especificaciones</h3>
            <div className="grilla-datos">
              <Dato etiqueta="Procesador" valor={equipo.procesador} />
              <Dato
                etiqueta="Memoria RAM"
                valor={equipo.memoriaRamGb ? `${equipo.memoriaRamGb} GB` : null}
              />
              <Dato
                etiqueta="Disco"
                valor={
                  equipo.discoCapacidadGb
                    ? `${equipo.discoCapacidadGb} GB ${equipo.discoTipo ?? ''}`.trim()
                    : null
                }
              />
              <Dato etiqueta="Sistema operativo" valor={equipo.sistemaOperativo} />
            </div>
          </>
        )}

        {(equipo.direccionIp || equipo.nombreEnRed || equipo.accesoRemoto !== 'NINGUNO') && (
          <>
            <h3 className="subtitulo-form">Red y acceso remoto</h3>
            <div className="grilla-datos">
              <Dato etiqueta="Dirección IP" valor={equipo.direccionIp} />
              <Dato etiqueta="Dirección MAC" valor={equipo.direccionMac} />
              <Dato etiqueta="Nombre en la red" valor={equipo.nombreEnRed} />
              <Dato etiqueta="Acceso remoto" valor={ETIQUETA_ACCESO[equipo.accesoRemoto]} />
              <Dato etiqueta="ID de acceso" valor={equipo.accesoRemotoId} />
            </div>
          </>
        )}

        {(equipo.proveedorNombre || equipo.fechaCompra || equipo.garantiaHasta) && (
          <>
            <h3 className="subtitulo-form">Compra</h3>
            <div className="grilla-datos">
              <Dato etiqueta="Proveedor" valor={equipo.proveedorNombre} />
              <Dato
                etiqueta="Fecha de compra"
                valor={equipo.fechaCompra ? formatearFechaSola(equipo.fechaCompra) : null}
              />
              <Dato
                etiqueta="Garantía hasta"
                valor={
                  equipo.garantiaHasta
                    ? `${formatearFechaSola(equipo.garantiaHasta)}${equipo.garantiaVencida ? ' (vencida)' : ''}`
                    : null
                }
              />
            </div>
          </>
        )}

        {equipo.notas && (
          <>
            <h3 className="subtitulo-form">Notas</h3>
            <p className="texto-suave">{equipo.notas}</p>
          </>
        )}

        <h3 className="subtitulo-form">Quién tuvo este equipo</h3>
        {!historial?.length && <p className="texto-suave">Sin movimientos registrados.</p>}
        {!!historial?.length && (
          <ul className="linea-tiempo">
            {historial.map((a) => (
              <li key={a.id}>
                <strong>{a.responsableNombre ?? 'Depósito'}</strong>
                {a.vigente && <span className="badge badge-ok">Actual</span>}
                <div className="texto-suave texto-chico">
                  Desde {formatearFecha(a.desde)}
                  {a.hasta ? ` hasta ${formatearFecha(a.hasta)}` : ''}
                  {a.motivo ? ` · ${a.motivo}` : ''}
                  {a.registradoPorNombre ? ` · registró ${a.registradoPorNombre}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Muchas de estas maquinas tienen clave de ingreso: el inicio de
            sesion de la PC, el acceso a una grabadora. Aca se ven las que le
            pertenecen, que es donde alguien parado frente al equipo las va a
            buscar. Los valores no: para eso hay que pedirlos desde el baul y
            queda registrado quien los miro. */}
        <CredencialesDelEquipo equipoItId={equipo.id} />

        {/* Las limpiezas, las actualizaciones de software y los arreglos: lo
            mismo que se anota de una máquina de planta, con el mismo módulo.
            Una PC formateada dos veces en un mes es un dato que solo aparece si
            queda escrito en algún lado. Un equipo dado de baja no recibe
            trabajos nuevos: el historial queda como está. */}
        <TrabajosDelEquipo
          equipoItId={equipo.id}
          equipoNombre={nombreDelEquipo(equipo)}
          permiteNuevos={equipo.estado !== 'DADO_DE_BAJA'}
        />

        {eliminar.error && <MensajeError error={eliminar.error} />}

        <div className="acciones">
          <button className="btn btn-primario" onClick={alEditar}>
            ✏️ Editar
          </button>
          <button
            className="btn btn-peligro"
            disabled={eliminar.isPending}
            onClick={async () => {
              if (!confirm(`¿Eliminar ${nombreDelEquipo(equipo)}? Esta acción no se deshace.`))
                return;
              await eliminar.mutateAsync(equipo.id);
              alCerrar();
            }}
          >
            Eliminar
          </button>
          <button className="btn" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────── Asignación ───────────────────────────
