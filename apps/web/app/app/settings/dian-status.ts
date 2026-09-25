export type DianReadinessTone = 'success' | 'warning' | 'danger' | 'neutral';

export function dianReadiness(status: { configured: boolean; status: string }): {
  label: string;
  detail: string;
  tone: DianReadinessTone;
} {
  if (status.configured && status.status === 'READY') {
    return {
      label: 'Credenciales listas para habilitación',
      detail: 'Aún debes enviar documentos y obtener aceptación DIAN.',
      tone: 'success',
    };
  }

  if (status.status === 'ERROR' || status.status === 'REJECTED') {
    return {
      label: 'Configuración requiere atención',
      detail: 'Revisa el detalle de la configuración antes de enviar documentos.',
      tone: 'danger',
    };
  }

  if (status.configured) {
    return {
      label: 'Configuración en proceso',
      detail: 'Espera el resultado de los documentos enviados a DIAN.',
      tone: 'warning',
    };
  }

  return {
    label: 'Credenciales sin configurar',
    detail: 'Carga el certificado y las credenciales DIAN para comenzar las pruebas.',
    tone: 'neutral',
  };
}
