import { zipSync } from 'fflate';

export class DianPackageService {
  zip(filename: string, xml: Buffer): Buffer {
    if (!/^[a-z0-9_-]+\.xml$/i.test(filename)) throw new Error('Nombre XML inválido');
    return Buffer.from(zipSync({ [filename]: new Uint8Array(xml) }, { level: 6 }));
  }
}
