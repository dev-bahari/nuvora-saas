import { Injectable } from '@nestjs/common';
import type { DraftDocument } from '@nuvora/contracts';

/**
 * XmlGeneratorService — produces a mock XML document from a persisted snapshot.
 * This is NOT DIAN-compliant UBL. Marked explicitly in the output.
 * Real UBL generation with XAdES signature is implemented in T14.
 */
@Injectable()
export class XmlGeneratorService {
  generate(doc: DraftDocument): Buffer {
    const snapshot = doc.customerSnapshot;
    const lines = doc.lines
      .map(
        (l, i) => `
    <cbc:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity>${l.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${doc.currency}">${l.lineTotal}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Description>${escapeXml(l.description)}</cbc:Description></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="${doc.currency}">${l.unitPrice}</cbc:PriceAmount></cac:Price>
    </cbc:InvoiceLine>`,
      )
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  NUVORA MOCK DOCUMENT — NOT DIAN-COMPLIANT UBL
  This file is for development and integration testing only.
  Real UBL generation with XAdES signature is available in T14.
-->
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>MOCK</cbc:CustomizationID>
  <cbc:ID>${doc.numberPrefix ?? ''}${doc.documentNumber ?? doc.id.slice(0, 8)}</cbc:ID>
  <cbc:IssueDate>${doc.issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${doc.currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(snapshot.legalName)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(snapshot.identification)}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${doc.currency}">${doc.subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${doc.currency}">${doc.grandTotal}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${doc.currency}">${doc.grandTotal}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>`;

    return Buffer.from(xml, 'utf-8');
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
