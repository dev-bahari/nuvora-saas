import type { DraftDocument } from '@nuvora/contracts';
import type { TenantInfo } from '../../artifacts/xml-generator.service.js';
import { DianPackageService } from './dian-package.service.js';
import { DianSoapClient } from './dian-soap-client.js';
import { PfxChainLoaderService } from '../signing/pfx-chain-loader.service.js';
import { XadesSignerService } from '../signing/xades-signer.service.js';
import { DianUblRendererService } from '../ubl/dian-ubl-renderer.service.js';

export class DianDirectSubmissionService {
  constructor(private readonly soap = new DianSoapClient()) {}
  async submit(input: { document: DraftDocument; tenant: TenantInfo; pfx: Buffer; password: string; caChain: Buffer; testSetId: string }) {
    const credentials = new PfxChainLoaderService().load(input.pfx, input.password, input.caChain);
    const unsigned = new DianUblRendererService().render(input.document, input.tenant);
    const signed = new XadesSignerService().sign(unsigned, credentials);
    const prefix = input.document.documentType === 'INVOICE' ? 'fv' : input.document.documentType === 'CREDIT_NOTE' ? 'nc' : 'nd';
    const name = `${prefix}${input.document.numberPrefix ?? ''}${input.document.documentNumber ?? input.document.id}.xml`.toLowerCase();
    const zip = new DianPackageService().zip(name, signed);
    return this.soap.sendTestSetAsync({ zipBase64: zip.toString('base64'), testSetId: input.testSetId, credentials });
  }
}
