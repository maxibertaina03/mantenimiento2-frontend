import { useState } from 'react';
import { useEnviarOrdenPorCorreo } from '@/api/ordenesCompra';
import { ApiError } from '@/lib/apiClient';
import {
  MAIL_ADMINISTRACION,
  WHATSAPP_ADMINISTRACION,
  enlaceCorreo,
  enlaceWhatsapp,
  esEmailValido,
} from '@/lib/envioOrden';
import { descargarPdfOrdenCompra, pdfOrdenComoBase64 } from '@/lib/pdfOrdenCompra';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * Envío de una orden ya impresa.
 *
 * El correo lo manda el servidor, con el PDF adjunto. WhatsApp no: ni la API de
 * WhatsApp ni un `mailto:` permiten adjuntar archivos desde el navegador, así
 * que ahí el PDF se descarga y lo adjunta la persona.
 *
 * Si el servidor no tiene el correo configurado (responde 503), la pantalla cae
 * al envío manual en vez de dejar a alguien sin poder mandar la orden.
 */
export function EnviarOrden({ orden, onCerrar }: { orden: OrdenCompra; onCerrar: () => void }) {
  const tieneEmail = esEmailValido(orden.proveedorEmail);
  const urlWhatsapp = enlaceWhatsapp(orden, orden.proveedorTelefono);
  // Provisorio, para probar el circuito sin escribirle a un proveedor real.
  const urlWhatsappAdmin = enlaceWhatsapp(orden, WHATSAPP_ADMINISTRACION);
  const urlCorreoManual = enlaceCorreo(orden, orden.proveedorEmail);

  const enviar = useEnviarOrdenPorCorreo();
  const [enviado, setEnviado] = useState<{ para: string[]; copia: string[] } | null>(null);
  const [sinSmtp, setSinSmtp] = useState(false);

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

  return (
    <Modal titulo={`Enviar ${orden.numero}`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        {enviado ? (
          <div className="alerta alerta-exito">
            <strong>Orden enviada</strong> a {enviado.para.join(', ')}
            {enviado.copia.length > 0 && <>, con copia a {enviado.copia.join(', ')}</>}, con el PDF
            adjunto.
          </div>
        ) : (
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
              <span>{MAIL_ADMINISTRACION}</span>
            </div>
            <div className="dato">
              <span className="texto-suave texto-chico">WhatsApp de administración</span>
              <span>{WHATSAPP_ADMINISTRACION}</span>
            </div>
          </div>
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
          Abre el chat con el mensaje escrito. <strong>El PDF hay que adjuntarlo a mano</strong>:
          WhatsApp no permite adjuntar archivos desde el navegador.
        </p>

        <div className="acciones-envio">
          {urlWhatsappAdmin && (
            <a
              className="btn btn-primario"
              href={urlWhatsappAdmin}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 A administración
            </a>
          )}

          {urlWhatsapp ? (
            <a className="btn" href={urlWhatsapp} target="_blank" rel="noopener noreferrer">
              💬 Al proveedor
            </a>
          ) : (
            <button className="btn" disabled title="El proveedor no tiene teléfono cargado">
              💬 Al proveedor
            </button>
          )}

          <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
            🖨 Descargar el PDF
          </button>
        </div>

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
