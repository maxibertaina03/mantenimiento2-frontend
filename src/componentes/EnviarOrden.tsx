import {
  MAIL_ADMINISTRACION,
  WHATSAPP_ADMINISTRACION,
  enlaceCorreo,
  enlaceWhatsapp,
  esEmailValido,
} from '@/lib/envioOrden';
import { descargarPdfOrdenCompra } from '@/lib/pdfOrdenCompra';
import { Modal } from './Modal';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * Envío de una orden ya impresa: correo y WhatsApp.
 *
 * Importante: **el PDF no se adjunta solo**. Ni `mailto:` ni la API de WhatsApp
 * permiten adjuntar archivos desde el navegador — es una restricción de
 * seguridad, no algo que se pueda sortear. Por eso el PDF se descarga primero y
 * la pantalla dice explícitamente que hay que adjuntarlo, en vez de dejar que
 * alguien mande un correo vacío creyendo que iba adjunto.
 */
export function EnviarOrden({ orden, onCerrar }: { orden: OrdenCompra; onCerrar: () => void }) {
  const tieneEmail = esEmailValido(orden.proveedorEmail);
  const urlWhatsapp = enlaceWhatsapp(orden, orden.proveedorTelefono);
  // Provisorio, para probar el circuito sin escribirle a un proveedor real.
  const urlWhatsappAdmin = enlaceWhatsapp(orden, WHATSAPP_ADMINISTRACION);
  const urlCorreo = enlaceCorreo(orden, orden.proveedorEmail);

  return (
    <Modal titulo={`Enviar ${orden.numero}`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <div className="alerta alerta-aviso">
          📎 El PDF ya se descargó. <strong>Acordate de adjuntarlo</strong> antes de enviar: ni
          el correo ni WhatsApp pueden adjuntarlo automáticamente desde el navegador.
        </div>

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

        <h3 className="subtitulo-form">Enviar por</h3>

        <div className="acciones-envio">
          {/* Se abre en el cliente de correo del usuario, ya logueado. */}
          <a className="btn btn-primario" href={urlCorreo}>
            ✉ Correo
          </a>

          {urlWhatsappAdmin && (
            <a
              className="btn btn-primario"
              href={urlWhatsappAdmin}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 WhatsApp a administración
            </a>
          )}

          {urlWhatsapp ? (
            <a className="btn" href={urlWhatsapp} target="_blank" rel="noopener noreferrer">
              💬 WhatsApp al proveedor
            </a>
          ) : (
            <button className="btn" disabled title="El proveedor no tiene teléfono cargado">
              💬 WhatsApp al proveedor
            </button>
          )}

          <button className="btn" onClick={() => descargarPdfOrdenCompra(orden)}>
            🖨 Descargar el PDF de nuevo
          </button>
        </div>

        {!tieneEmail && (
          <p className="texto-suave texto-chico">
            El proveedor no tiene correo cargado, así que la orden va dirigida a administración.
            Podés agregarle el correo desde Proveedores y volver a enviarla.
          </p>
        )}
        {!urlWhatsapp && orden.proveedorTelefono && (
          <p className="texto-suave texto-chico">
            El teléfono cargado («{orden.proveedorTelefono}») no parece un número de celular
            válido, así que no se puede armar el enlace de WhatsApp.
          </p>
        )}

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Listo
          </button>
        </div>
      </div>
    </Modal>
  );
}
