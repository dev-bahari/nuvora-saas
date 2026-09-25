import { describe, expect, it } from 'vitest';
import { dianReadiness } from './dian-status.js';

describe('dianReadiness', () => {
  it('describes READY credentials without claiming DIAN approval', () => {
    expect(dianReadiness({ configured: true, status: 'READY' })).toEqual({
      label: 'Credenciales listas para habilitación',
      detail: 'Aún debes enviar documentos y obtener aceptación DIAN.',
      tone: 'success',
    });
  });

  it('describes missing credentials as not configured', () => {
    expect(dianReadiness({ configured: false, status: 'UNCONFIGURED' })).toMatchObject({
      label: 'Credenciales sin configurar',
      tone: 'neutral',
    });
  });
});
