/**
 * Unit tests — CUFE computation (Task 14)
 * Validates the SHA-384 formula matches DIAN Anexo Técnico 1.9.
 */

import { describe, it, expect } from 'vitest';
import { CufeService } from '../../apps/api/src/artifacts/cufe.service.js';
import crypto from 'node:crypto';

const cufe = new CufeService();

describe('CufeService', () => {
  it('produces a 96-char lowercase hex SHA-384', () => {
    const result = cufe.compute({
      numFac: 'SETP990000001',
      fecFac: '2024-01-15',
      horFac: '10:00:00-05:00',
      valFac: '1000000.00',
      valImp01: '190000.00',
      valImp02: '0.00',
      valImp03: '0.00',
      valTot: '1190000.00',
      nitOfe: '900123456',
      numAdq: '800200400',
      clTec: 'fc8eac422abb391c968994c4e8a9a4c6',
      tipoAmb: '2',
    });
    expect(result).toHaveLength(96);
    expect(result).toMatch(/^[0-9a-f]{96}$/);
  });

  it('matches manual SHA-384 computation', () => {
    const p = {
      numFac: 'SETP990000001',
      fecFac: '2024-01-15',
      horFac: '10:00:00-05:00',
      valFac: '1000000.00',
      valImp01: '190000.00',
      valImp02: '0.00',
      valImp03: '0.00',
      valTot: '1190000.00',
      nitOfe: '900123456',
      numAdq: '800200400',
      clTec: 'fc8eac422abb391c968994c4e8a9a4c6',
      tipoAmb: '2' as const,
    };
    const raw =
      p.numFac + p.fecFac + p.horFac +
      p.valFac + '01' + p.valImp01 +
      '02' + p.valImp02 +
      '03' + p.valImp03 +
      p.valTot + p.nitOfe + p.numAdq + p.clTec + p.tipoAmb;

    const expected = crypto.createHash('sha384').update(raw, 'utf8').digest('hex');
    expect(cufe.compute(p)).toBe(expected);
  });

  it('different clTec → different CUFE', () => {
    const base = {
      numFac: 'FV-001', fecFac: '2024-06-01', horFac: '09:00:00-05:00',
      valFac: '500000.00', valImp01: '95000.00', valImp02: '0.00', valImp03: '0.00',
      valTot: '595000.00', nitOfe: '900111222', numAdq: '123456789',
      clTec: 'keyA', tipoAmb: '2' as const,
    };
    expect(cufe.compute(base)).not.toBe(cufe.compute({ ...base, clTec: 'keyB' }));
  });

  it('softwareSecurityCode is 96-char SHA-384', () => {
    const ssc = cufe.softwareSecurityCode('my-software-id', 'my-pin', 'FV-001');
    expect(ssc).toHaveLength(96);
    expect(ssc).toMatch(/^[0-9a-f]{96}$/);
  });

  it('colombiaTime returns HH:MM:SS-05:00 format', () => {
    const t = CufeService.colombiaTime();
    expect(t).toMatch(/^\d{2}:\d{2}:\d{2}-05:00$/);
  });
});
