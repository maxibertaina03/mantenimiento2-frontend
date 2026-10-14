import { useState } from 'react';
import { ApiError, apiRequest } from '@/lib/apiClient';
import {
  useEnviarTrabajoPorCorreo,
  useEnviosDeTrabajo,
  useRegistrarTrabajoWhatsapp,
} from '@/api/ordenesTrabajo';
import { useProveedor } from '@/api/proveedores';
import { aNumeroWhatsapp, esEmailValido } from '@/lib/envioOrden';
import { enlaceWhatsappTaller } from '@/lib/envioOrdenTrabajo';
import { formatearFecha } from '@/lib/formato';
import { descargarPdfOrdenTrabajo, pdfOrdenTrabajoComoBase64 } from '@/lib/pdfOrdenTrabajo';
import type { Equipo } from '@/tipos/equipo';
import type { OrdenTrabajo } from '@/tipos/ordenTrabajo';
import { ContactoProveedor } from './ContactoProveedor';
import { MensajeError } from './Estados';
import { Modal } from './Modal';

/** La ficha del equipo para el papel; si no se puede traer, sale con lo que hay. */
async function fichaDelEquipo(orden: OrdenTrabajo): Promise<Equipo | null> {
  if (!orden.equipoId) return null;
  try {
    return await apiRequest<Equipo>(`/equipos/${orden.equipoId}`);
  } catch {
    return null;
  }
}

/**
 * Mandarle la orden de trabajo al taller de afuera.
 *
 * Igual que las órdenes de compra: el correo sale desde el servidor con el PDF
 * adjunto; WhatsApp abre el chat con el texto escrito y la persona adjunta el
 * PDF. Los dos quedan registrados, para poder contestar «¿ya se lo mandamos?».
 */
export function EnviarOrdenTrabajo({
  orden,
  onCerrar,
}: {
  orden: OrdenTrabajo;
  onCerrar: () => void;
}) {
  const { data: taller, refetch } = useProveedor(orden.proveedorId);
  const { data: envios } = useEnviosDeTrabajo(orden.id);
  const enviar = useEnviarTrabajoPorCorreo();
  const registrarWhatsapp = useRegistrarTrabajoWhatsapp();
  const [enviadoA, setEnviadoA] = useState<string[] | null>(null);
  const [sinCorreo, setSinCorreo] = useState(false);
  const [abiertoWhatsapp, setAbiertoWhatsapp] = useState(false);

  const email = taller?.email ?? null;
  const telefono = taller?.telefono ?? null;
  const tieneEmail = esEmailValido(email);
  const urlWhatsapp = enlaceWhatsappTaller(orden, telefono);
  const numero = aNumeroWhatsapp(telefono);

  const pdf = async () => {
    const equipo = await fichaDelEquipo(orden);
    return { equipo, proveedor: taller ?? null };
  };

  const porCorreo = async () => {
    try {
      const pdfBase64 = await pdfOrdenTrabajoComoBase64(orden, await pdf());
      const res = await enviar.mutateAsync({ id: orden.id, pdfBase64 });
      setEnviadoA(res.para);
    } catch (error) {
      // 503: el servidor no tiene el correo configurado. Queda WhatsApp.
      if (error instanceof ApiError && error.statusCode === 503) setSinCorreo(true);
    }
  };

  const porWhatsapp = async () => {
    if (!urlWhatsapp || !numero) return;
    window.open(urlWhatsapp, '_blank', 'noopener,noreferrer');
    setAbiertoWhatsapp(true);
    try {
      await registrarWhatsapp.mutateAsync({ id: orden.id, numero });
    } catch {
      // El chat ya se abrió: el error de registro se muestra abajo.
    }
  };

  return (
    <Modal titulo={`Mandar ${orden.numero} al taller`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p>
          A <strong>{orden.proveedorNombre ?? 'el taller'}</strong>: {orden.titulo}
          {orden.equipoNombre ? ` · ${orden.equipoNombre}` : ''}
        </p>

        {orden.proveedorId && (
          <ContactoProveedor
            proveedorId={orden.proveedorId}
            nombre={orden.proveedorNombre}
            email={email}
            telefono={telefono}
            onGuardado={() => void refetch()}
          />
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

        <h3 className="subtitulo-form">Correo</h3>
        {enviadoA ? (
          <div className="alerta alerta-exito">
            ✔ Orden enviada a {enviadoA.join(', ')} con el PDF adjunto. Quedó registrado.
          </div>
        ) : sinCorreo ? (
          <div className="alerta alerta-aviso">
            El envío automático de correo no está configurado en el servidor. Mandásela por
            WhatsApp.
          </div>
        ) : (
          <>
            <p className="texto-suave texto-chico">
              {tieneEmail
                ? `Sale desde el sistema a ${email}, con el PDF adjunto. Si el taller responde, la respuesta te llega a vos.`
                : 'El taller no tiene correo cargado. Cargáselo arriba, o mandásela por WhatsApp.'}
            </p>
            <div className="acciones-envio">
              <button
                type="button"
                className="btn btn-primario"
                onClick={porCorreo}
                disabled={enviar.isPending || !tieneEmail}
              >
                {enviar.isPending ? 'Enviando…' : '✉ Enviar por correo'}
              </button>
            </div>
            {enviar.error && !sinCorreo && <MensajeError error={enviar.error} />}
          </>
        )}

        <h3 className="subtitulo-form">WhatsApp</h3>
        <p className="texto-suave texto-chico">
          Abre el chat con el mensaje escrito. <strong>Tocá enviar y adjuntá el PDF</strong>:
          WhatsApp no deja adjuntarlo desde el navegador. Queda registrado apenas se abre el chat.
        </p>
        <div className="acciones-envio">
          <button
            type="button"
            className="btn btn-primario"
            onClick={porWhatsapp}
            disabled={!urlWhatsapp || registrarWhatsapp.isPending}
            title={urlWhatsapp ? undefined : 'El taller no tiene un celular cargado'}
          >
            💬 Mandar por WhatsApp
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => descargarPdfOrdenTrabajo(orden, await pdf())}
          >
            🖨 Descargar el PDF
          </button>
        </div>
        {!urlWhatsapp && (
          <p className="texto-suave texto-chico">
            {telefono
              ? `El teléfono cargado («${telefono}») no parece un celular: corregilo arriba.`
              : 'El taller no tiene celular cargado: cargáselo con el botón de arriba.'}
          </p>
        )}
        {abiertoWhatsapp && !registrarWhatsapp.error && (
          <p className="texto-suave texto-chico">✔ Envío por WhatsApp registrado.</p>
        )}
        {registrarWhatsapp.error && <MensajeError error={registrarWhatsapp.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            {enviadoA || abiertoWhatsapp ? 'Listo' : 'Cerrar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
