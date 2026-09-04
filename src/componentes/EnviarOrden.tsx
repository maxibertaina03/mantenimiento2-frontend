import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  clavesOrdenes,
  useConfiguracionEnvio,
  useEnviarOrdenPorCorreo,
  useEnviosDeOrden,
  useRegistrarEnvioWhatsapp,
} from '@/api/ordenesCompra';
import { ApiError } from '@/lib/apiClient';
import { aNumeroWhatsapp, enlaceCorreo, enlaceWhatsapp, esEmailValido } from '@/lib/envioOrden';
import { descargarPdfOrdenCompra, pdfOrdenComoBase64 } from '@/lib/pdfOrdenCompra';
import { formatearFecha } from '@/lib/formato';
import { ContactoProveedor } from './ContactoProveedor';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * Envío de una orden ya impresa.
 *
 * El correo lo manda el servidor, con el PDF adjunto. WhatsApp no: ni la API de
 * WhatsApp ni un `mailto:` permiten adjuntar archivos desde el navegador, así
 * que ahí el sistema abre el chat con el texto escrito y la persona toca enviar
 * y adjunta el PDF.
 *
 * Los dos caminos dejan constancia y emiten la orden. Que "se mandó" signifique
 * lo mismo en los dos es lo que permite contestar después "¿ya se la mandamos?"
 * sin buscar en la casilla de quien la haya mandado.
 *
 * Si el servidor no tiene el correo configurado (responde 503), la pantalla cae
 * al envío manual en vez de dejar a alguien sin poder mandar la orden.
 */
export function EnviarOrden({ orden, onCerrar }: { orden: OrdenCompra; onCerrar: () => void }) {
  const qc = useQueryClient();
  const { data: config } = useConfiguracionEnvio();
  const { data: envios } = useEnviosDeOrden(orden.id);

  const tieneEmail = esEmailValido(orden.proveedorEmail);
  const urlWhatsapp = enlaceWhatsapp(orden, orden.proveedorTelefono);
  const numeroProveedor = aNumeroWhatsapp(orden.proveedorTelefono);
  const urlWhatsappAdmin = enlaceWhatsapp(orden, config?.whatsappAdministracion);
  const numeroAdmin = aNumeroWhatsapp(config?.whatsappAdministracion);
  const urlCorreoManual = enlaceCorreo(orden, orden.proveedorEmail, config?.mailAdministracion);

  const enviar = useEnviarOrdenPorCorreo();
  const registrarWhatsapp = useRegistrarEnvioWhatsapp();
  const [enviado, setEnviado] = useState<{ para: string[]; copia: string[] } | null>(null);
  const [sinSmtp, setSinSmtp] = useState(false);

  /** Refresca la orden mostrada: mandarla la emite y deja de ser editable. */
  const refrescar = () => qc.invalidateQueries({ queryKey: clavesOrdenes.base });

  const enviarPorCorreo = async () => {
    try {
      const pdfBase64 = await pdfOrdenComoBase64(orden);
      const res = await enviar.mutateAsync({ id: orden.id, pdfBase64 });
      setEnviado({ para: res.para, copia: res.copia });
    } catch (error) {
      // 503 = el servidor no tiene el correo configurado. No es un fallo del
      // usuario ni algo para reintentar: hay que mandarlo a mano.
      if (error instanceof ApiError && error.statusCode === 503) setSinSmtp(true);
    }
  };

  /**
   * Abre el chat y deja constancia.
   *
   * Se registra al abrir, que es lo último que el sistema llega a ver: WhatsApp
   * no le avisa a nadie si la persona después no manda. Queda deliberadamente
   * optimista, porque lo contrario —no registrar nada— deja la orden editable
   * después de que el proveedor la recibió, que es bastante peor.
   */
  const abrirWhatsapp = async (url: string, numero: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    try {
      await registrarWhatsapp.mutateAsync({ id: orden.id, numero });
    } catch {
      // Si no se pudo registrar, el chat ya se abrió igual: no tiene sentido
      // frenar a nadie por eso. El error se muestra abajo.
    }
  };

  return (
    <Modal titulo={`Enviar ${orden.numero}`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        {enviado ? (
          <div className="alerta alerta-exito">
            <strong>Orden enviada</strong> a {enviado.para.join(', ')}
            {enviado.copia.length > 0 && <>, con copia a {enviado.copia.join(', ')}</>}, con el PDF
            adjunto. La orden quedó <strong>emitida</strong>.
          </div>
        ) : (
          <>
            <div className="grilla-datos">
              <div className="dato">
                <span className="texto-suave texto-chico">Proveedor</span>
                <span>{orden.proveedorNombre ?? '—'}</span>
              </div>
              <div className="dato">
                <span className="texto-suave texto-chico">Correo del proveedor</span>
                <span>{tieneEmail ? orden.proveedorEmail : 'Sin correo cargado'}</span>
              </div>
              <div className="dato">
                <span className="texto-suave texto-chico">Teléfono</span>
                <span>{orden.proveedorTelefono || 'Sin teléfono cargado'}</span>
              </div>
              <div className="dato">
                <span className="texto-suave texto-chico">Copia interna</span>
                <span>{config?.mailAdministracion ?? '—'}</span>
              </div>
            </div>

            <ContactoProveedor
              proveedorId={orden.proveedorId}
              nombre={orden.proveedorNombre}
              email={orden.proveedorEmail}
              telefono={orden.proveedorTelefono}
              onGuardado={refrescar}
            />
          </>
        )}

        {envios && envios.length > 0 && (
          <>
            <h3 className="subtitulo-form">Ya se mandó</h3>
            <ul className="lista-envios">
              {envios.map((e) => (
                <li key={e.id}>
                  <span>
                    {e.via === 'CORREO' ? '✉' : '💬'} {e.destinatarios}
                    {!e.automatico && <span className="texto-suave"> (a mano)</span>}
                  </span>
                  <span className="texto-suave texto-chico">
                    {formatearFecha(e.enviadoEn)}
                    {e.usuarioNombre && ` · ${e.usuarioNombre}`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {!enviado && (
          <>
            <h3 className="subtitulo-form">Correo</h3>
            {sinSmtp ? (
              <>
                <div className="alerta alerta-aviso">
                  El envío automático no está configurado en el servidor. Podés mandarla desde tu
                  correo, pero <strong>acordate de adjuntar el PDF</strong>.
                </div>
                <div className="acciones-envio">
                  <a className="btn btn-primario" href={urlCorreoManual}>
                    ✉ Abrir mi correo
                  </a>
                  <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
                    🖨 Descargar el PDF
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="texto-suave texto-chico">
                  Sale desde el sistema con el PDF adjunto
                  {tieneEmail ? (
                    <>
                      {' '}
                      a <strong>{orden.proveedorEmail}</strong>, con copia a administración.
                    </>
                  ) : (
                    <>
                      {' '}
                      a <strong>administración</strong>: el proveedor no tiene correo cargado.
                      Cargáselo arriba y sale directo.
                    </>
                  )}{' '}
                  Si el proveedor responde, la respuesta te llega a vos.
                </p>
                <div className="acciones-envio">
                  <button
                    className="btn btn-primario"
                    onClick={enviarPorCorreo}
                    disabled={enviar.isPending}
                  >
                    {enviar.isPending ? 'Enviando…' : '✉ Enviar por correo'}
                  </button>
                </div>
                {enviar.error && !sinSmtp && <MensajeError error={enviar.error} />}
              </>
            )}
          </>
        )}

        <h3 className="subtitulo-form">WhatsApp</h3>
        <p className="texto-suave texto-chico">
          Abre el chat con el mensaje escrito. <strong>Tocá enviar y adjuntá el PDF</strong>:
          WhatsApp no permite adjuntar archivos desde el navegador. La orden queda registrada como
          enviada apenas se abre el chat.
        </p>

        <div className="acciones-envio">
          {urlWhatsapp && numeroProveedor ? (
            <button
              className="btn btn-primario"
              onClick={() => abrirWhatsapp(urlWhatsapp, numeroProveedor)}
              disabled={registrarWhatsapp.isPending}
            >
              💬 Al proveedor
            </button>
          ) : (
            <button className="btn" disabled title="El proveedor no tiene teléfono cargado">
              💬 Al proveedor
            </button>
          )}

          {urlWhatsappAdmin && numeroAdmin && (
            <button
              className="btn"
              onClick={() => abrirWhatsapp(urlWhatsappAdmin, numeroAdmin)}
              disabled={registrarWhatsapp.isPending}
            >
              💬 A administración
            </button>
          )}

          <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
            🖨 Descargar el PDF
          </button>
        </div>

        {registrarWhatsapp.error && <MensajeError error={registrarWhatsapp.error} />}

        {!urlWhatsapp && orden.proveedorTelefono && (
          <p className="texto-suave texto-chico">
            El teléfono cargado («{orden.proveedorTelefono}») no parece un número de celular
            válido, así que no se puede armar el enlace de WhatsApp.
          </p>
        )}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            {enviado ? 'Listo' : 'Cerrar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
