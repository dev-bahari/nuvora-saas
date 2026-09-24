import type { DraftDocument } from '@nuvora/contracts';
import { CufeService } from '../../artifacts/cufe.service.js';
import { XmlGeneratorService, type TenantInfo } from '../../artifacts/xml-generator.service.js';

export class DianUblRendererService {
  private readonly invoice = new XmlGeneratorService(new CufeService());

  render(document: DraftDocument, tenant: TenantInfo, source?: { number: string; uuid: string; issueDate: string }): Buffer {
    let xml = this.invoice.generate(document, tenant).toString().replace(/\s*<!-- XAdES-BES signature placeholder[^]*?-->\s*/g, '');
    if (document.documentType === 'INVOICE') return Buffer.from(xml);
    const credit = document.documentType === 'CREDIT_NOTE';
    const root = credit ? 'CreditNote' : 'DebitNote';
    const line = credit ? 'CreditNoteLine' : 'DebitNoteLine';
    const quantity = credit ? 'CreditedQuantity' : 'DebitedQuantity';
    if (!source) throw new Error('Las notas requieren la referencia fiscal de la factura origen');
    const reference = `<cac:DiscrepancyResponse><cbc:ReferenceID>${escapeXml(source.number)}</cbc:ReferenceID><cbc:ResponseCode>${escapeXml(document.reasonCode ?? (credit ? '1' : '2'))}</cbc:ResponseCode><cbc:Description>${escapeXml(document.notes ?? (credit ? 'Nota crédito' : 'Nota débito'))}</cbc:Description></cac:DiscrepancyResponse><cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${escapeXml(source.number)}</cbc:ID><cbc:UUID schemeName="CUFE-SHA384">${escapeXml(source.uuid)}</cbc:UUID><cbc:IssueDate>${source.issueDate}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>`;
    xml = xml
      .replace(/xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/, `xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2"`)
      .replace('<Invoice ', `<${root} `).replace('</Invoice>', `</${root}>`)
      .replace(/<cbc:InvoiceTypeCode[^>]*>01<\/cbc:InvoiceTypeCode>/, `<cbc:${root}TypeCode>${credit ? '91' : '92'}</cbc:${root}TypeCode>`)
      .replace('schemeName="CUFE-SHA384"', 'schemeName="CUDE-SHA384"')
      .replace(/(<cbc:LineCountNumeric>[^<]+<\/cbc:LineCountNumeric>)/, `$1${reference}`)
      .replaceAll('cac:InvoiceLine', `cac:${line}`).replaceAll('cbc:InvoicedQuantity', `cbc:${quantity}`);
    return Buffer.from(xml);
  }
}

function escapeXml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!); }
