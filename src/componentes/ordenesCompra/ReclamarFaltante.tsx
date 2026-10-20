import {
  Check,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  clavesOrdenes,
  useConfiguracionEnvio,
  useReclamarPorCorreo,
  useRegistrarReclamoWhatsapp,
} from '@/api/ordenesCompra';
import { ContactoProveedor } from '@/componentes/ContactoProveedor';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { ApiError } from '@/lib/apiClient';
import {
  aNumeroWhatsapp,
  armarReclamo,
  enlaceWhatsappReclamo,
  esEmailValido,
} from '@/lib/envioOrden';
import { formatearNumero } from '@/lib/formato';
import { nombreDelRenglon } from '@/tipos/ordenCompra';
import type { OrdenCompra } from '@/tipos/ordenCompra';

/**
 * Reclamarle al proveedor lo que falta entregar de una orden.
 *
 * Igual que mandar la orden: el correo sale desde el servidor (solo con lo
 * pendiente, sin PDF), y WhatsApp abre el chat con el texto escrito. Los dos
 * quedan registrados en los envíos de la orden como reclamo, para poder
 * contestar después «¿ya se lo reclamamos?».
 */
export function ReclamarFaltante({
  orden,
  onCerrar,
}: {
  orden: OrdenCompra;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { data: config } = useConfiguracionEnvio();
  const reclamarCorreo = useReclamarPorCorreo();
  const registrarWhatsapp = useRegistrarReclamoWhatsapp();
  const [enviadoA, setEnviadoA] = useState<string[] | null>(null);
  const [sinCorreo, setSinCorreo] = useState(false);
  const [abiertoWhatsapp, setAbiertoWhatsapp] = useState(false);

  const pendientes = orden.renglones.filter((r) => r.pendiente > 0);
  const tieneEmail = esEmailValido(orden.proveedorEmail);
  const urlWhatsapp = enlaceWhatsappReclamo(orden, orden.proveedorTelefono);
  const numero = aNumeroWhatsapp(orden.proveedorTelefono);

  const porCorreo = async () => {
    try {
      const res = await reclamarCorreo.mutateAsync(orden.id);
      setEnviadoA([...res.para, ...res.copia]);
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
    <Modal titulo={`Reclamar lo que falta de ${orden.numero}`} abierto onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p>
          A <strong>{orden.proveedorNombre ?? 'el proveedor'}</strong> le falta entregar:
        </p>
        <ul className="entregas-lista">
          {pendientes.map((r) => (
            <li key={r.id}>
              {nombreDelRenglon(r) ?? 'Material'} —{' '}
              <strong>
                {formatearNumero(r.pendiente)} {r.unidad ?? ''}
              </strong>
            </li>
          ))}
        </ul>

        <ContactoProveedor
          proveedorId={orden.proveedorId}
          nombre={orden.proveedorNombre}
          email={orden.proveedorEmail}
          telefono={orden.proveedorTelefono}
          onGuardado={() => qc.invalidateQueries({ queryKey: clavesOrdenes.base })}
        />

        <h3 className="subtitulo-form">Correo</h3>
        {enviadoA ? (
          <div className="alerta alerta-exito">
            <Check className="icono" aria-hidden />
            Reclamo enviado a {enviadoA.join(', ')}. Quedó registrado en los envíos de la orden.
          </div>
        ) : sinCorreo ? (
          <div className="alerta alerta-aviso">
            El envío automático de correo no está configurado en el servidor. Reclamale por
            WhatsApp.
          </div>
        ) : (
          <>
            <p className="texto-suave texto-chico">
              {tieneEmail || config?.mailAdministracion
                ? 'Sale desde el sistema con la lista de lo que falta. Si el proveedor responde, la respuesta te llega a vos.'
                : 'El proveedor no tiene correo cargado. Cargáselo arriba, o reclamale por WhatsApp.'}
            </p>
            <div className="acciones-envio">
              <button
                type="button"
                className="btn btn-primario"
                onClick={porCorreo}
                disabled={reclamarCorreo.isPending || !(tieneEmail || config?.mailAdministracion)}
              >
                <Mail className="icono" aria-hidden />
                {reclamarCorreo.isPending ? 'Enviando…' : 'Reclamar por correo'}
              </button>
            </div>
            {reclamarCorreo.error && !sinCorreo && <MensajeError error={reclamarCorreo.error} />}
          </>
        )}

        <h3 className="subtitulo-form">WhatsApp</h3>
        <p className="texto-suave texto-chico">
          Abre el chat con el reclamo escrito; tocá enviar. Queda registrado apenas se abre.
        </p>
        <div className="acciones-envio">
          <button
            type="button"
            className="btn btn-primario"
            onClick={porWhatsapp}
            disabled={!urlWhatsapp || registrarWhatsapp.isPending}
            title={urlWhatsapp ? undefined : 'El proveedor no tiene un celular cargado'}
          >
            <MessageCircle className="icono" aria-hidden />
            Reclamar por WhatsApp
          </button>
        </div>
        {!urlWhatsapp && (
          <p className="texto-suave texto-chico">
            {orden.proveedorTelefono
              ? `El teléfono cargado («${orden.proveedorTelefono}») no parece un celular: corregilo arriba.`
              : 'El proveedor no tiene celular cargado: cargáselo con el botón de arriba.'}
          </p>
        )}
        {abiertoWhatsapp && !registrarWhatsapp.error && (
          <p className="texto-suave texto-chico">
            <Check className="icono" aria-hidden /> Reclamo por WhatsApp registrado.
          </p>
        )}
        {registrarWhatsapp.error && <MensajeError error={registrarWhatsapp.error} />}

        <details>
          <summary className="texto-suave texto-chico">Ver el texto del reclamo</summary>
          <pre className="texto-reclamo">{armarReclamo(orden).cuerpo}</pre>
        </details>

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
