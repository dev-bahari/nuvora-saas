import type { DraftDocument } from '@nuvora/contracts';
import { CufeService } from '../../artifacts/cufe.service.js';
import { XmlGeneratorService, type TenantInfo } from '../../artifacts/xml-generator.service.js';

export class DianUblRendererService {
  private readonly invoice = new XmlGeneratorService(new CufeService());

  render(document: DraftDocument, tenant: TenantInfo): Buffer {
    let xml = this.invoice.generate(document, tenant).toString().replace(/\s*<!-- XAdES-BES signature placeholder[^]*?-->\s*/g, '');
    if (document.documentType === 'INVOICE') return Buffer.from(xml);
    const credit = document.documentType === 'CREDIT_NOTE';
    const root = credit ? 'CreditNote' : 'DebitNote';
    const line = credit ? 'CreditNoteLine' : 'DebitNoteLine';
    const quantity = credit ? 'CreditedQuantity' : 'DebitedQuantity';
    xml = xml
      .replace(/xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/, `xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2"`)
      .replace('<Invoice ', `<${root} `).replace('</Invoice>', `</${root}>`)
      .replace(/<cbc:InvoiceTypeCode[^>]*>01<\/cbc:InvoiceTypeCode>/, `<cbc:${root}TypeCode>${credit ? '91' : '92'}</cbc:${root}TypeCode>`)
      .replace('schemeName="CUFE-SHA384"', 'schemeName="CUDE-SHA384"')
      .replaceAll('cac:InvoiceLine', `cac:${line}`).replaceAll('cbc:InvoicedQuantity', `cbc:${quantity}`);
    return Buffer.from(xml);
  }
}
