import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface CufeParams {
  /** Full invoice number e.g. "SETP990000001" */
  numFac: string;
  /** "YYYY-MM-DD" */
  fecFac: string;
  /** "HH:MM:SS-05:00" */
  horFac: string;
  /** Subtotal (base gravable) as "1000000.00" */
  valFac: string;
  /** IVA amount as "190000.00" */
  valImp01: string;
  /** IC (Impuesto al Consumo) amount as "0.00" */
  valImp02: string;
  /** ICA amount as "0.00" */
  valImp03: string;
  /** Grand total as "1190000.00" */
  valTot: string;
  /** Issuer NIT without DV and dashes e.g. "900123456" */
  nitOfe: string;
  /** Customer identification e.g. "800200400" */
  numAdq: string;
  /** DIAN technical key (clave técnica) — empty string for habilitacion without key */
  clTec: string;
  /** "1" = producción, "2" = habilitación */
  tipoAmb: '1' | '2';
}

/**
 * CufeService — computes the Código Único de Factura Electrónica per DIAN
 * Anexo Técnico 1.9 formula:
 *   CUFE = lowercase(SHA-384(NumFac+FecFac+HorFac+ValFac+CodImp1+ValImp1+
 *                            CodImp2+ValImp2+CodImp3+ValImp3+ValTot+
 *                            NitOFE+NumAdq+ClTec+TipoAmb))
 *
 * SoftwareSecurityCode = lowercase(SHA-384(softwareId + pin + numFac))
 */
@Injectable()
export class CufeService {
  compute(p: CufeParams): string {
    const raw =
      p.numFac +
      p.fecFac +
      p.horFac +
      p.valFac +
      '01' + p.valImp01 +
      '02' + p.valImp02 +
      '03' + p.valImp03 +
      p.valTot +
      p.nitOfe +
      p.numAdq +
      p.clTec +
      p.tipoAmb;

    return crypto.createHash('sha384').update(raw, 'utf8').digest('hex');
  }

  softwareSecurityCode(softwareId: string, pin: string, numFac: string): string {
    return crypto.createHash('sha384').update(softwareId + pin + numFac, 'utf8').digest('hex');
  }

  /** Current Colombia time string "HH:MM:SS-05:00" */
  static colombiaTime(): string {
    const now = new Date();
    // UTC-5 (Colombia, no DST)
    const col = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const h = col.getUTCHours().toString().padStart(2, '0');
    const m = col.getUTCMinutes().toString().padStart(2, '0');
    const s = col.getUTCSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}-05:00`;
  }
}
