import { Injectable } from '@nestjs/common';
import type { DraftDocument, DraftLine, DraftTaxSummary } from '@nuvora/contracts';
import { CufeService } from './cufe.service.js';
import { Decimal } from 'decimal.js';

export interface TenantInfo {
  legalName: string;
  nit: string;           // without DV/dashes e.g. "900123456"
  dv?: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  taxRegime: string;
  dianEnvironment: 'HABILITACION' | 'PRODUCCION';
  dianSoftwareId: string | null;
  dianSoftwarePin: string | null;
  dianTechnicalKey: string | null;
  invoiceAuthorization?: string;
  authorizationPrefix?: string;
  authorizationFrom?: string;
  authorizationTo?: string;
  authorizationStartDate?: string;
  authorizationEndDate?: string;
}

// Colombian identification type → DIAN schemeID
const ID_SCHEME: Record<string, string> = {
  NIT: '31', CC: '13', CE: '22', PASAPORTE: '91', PASSPORT: '91',
  TI: '12', RC: '11', DE: '21', NIUP: '91',
};

// Tax treatment → DIAN TaxLevelCode
const TAX_LEVEL: Record<string, string> = {
  COMUN: 'O-13', SIMPLIFICADO: 'O-47', NO_APLICA: 'O-99',
};

const X = escapeXml;

/**
 * XmlGeneratorService — produces DIAN-compliant UBL 2.1 XML per Anexo Técnico 1.9.
 * The signature slot (ext:ExtensionContent for XAdES) is a placeholder — filled in T14.3.
 */
@Injectable()
export class XmlGeneratorService {
  constructor(private readonly cufe = new CufeService()) {}

  generate(doc: DraftDocument, tenant?: TenantInfo): Buffer {
    const env = tenant?.dianEnvironment ?? 'HABILITACION';
    const tipoAmb: '1' | '2' = env === 'PRODUCCION' ? '1' : '2';
    const profileExecId = tipoAmb; // same value per spec

    const numFac = `${doc.numberPrefix ?? ''}${doc.documentNumber ?? doc.id.slice(0, 8)}`;
    const horFac = CufeService.colombiaTime();
    const nitOfe = (tenant?.nit ?? '').replace(/[^0-9]/g, '');
    const numAdq = doc.customerSnapshot.identification.replace(/[^0-9a-zA-Z]/g, '');

    // Tax amounts by DIAN code (01=IVA, 02=IC, 03=ICA)
    const ivaAmount = sumTax(doc.taxSummary, ['TAXED']);
    const icAmount = '0.00';   // IC not yet modeled — extend later
    const icaAmount = '0.00';  // ICA not yet modeled

    // CUFE — use stored value if already computed, otherwise recompute
    const cufe = doc.cude ?? this.cufe.compute({
      numFac, fecFac: doc.issueDate, horFac,
      valFac: doc.subtotal, valImp01: ivaAmount, valImp02: icAmount, valImp03: icaAmount,
      valTot: doc.grandTotal, nitOfe, numAdq,
      clTec: tenant?.dianTechnicalKey ?? '',
      tipoAmb,
    });

    // Software security code
    const ssc = (tenant?.dianSoftwareId && tenant?.dianSoftwarePin)
      ? this.cufe.softwareSecurityCode(tenant.dianSoftwareId, tenant.dianSoftwarePin, numFac)
      : cufe.slice(0, 96); // fallback — replace with real ssc when credentials present

    const softwareId = tenant?.dianSoftwareId ?? 'PENDING-SOFTWARE-ID';
    const taxLevelCode = TAX_LEVEL[tenant?.taxRegime ?? 'SIMPLIFICADO'] ?? 'O-47';
    const issuerSchemeId = ID_SCHEME['NIT'];
    const custSchemeId = ID_SCHEME[doc.customerSnapshot.identificationType] ?? '13';

    const qrUrl = `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cufe}`;

    const lineCount = doc.lines.length;

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
         xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <sts:DianExtensions>
          <sts:InvoiceControl>
            <sts:InvoiceAuthorization>${X(tenant?.invoiceAuthorization ?? '')}</sts:InvoiceAuthorization>
            <sts:AuthorizationPeriod>
              <cbc:StartDate>${tenant?.authorizationStartDate ?? doc.issueDate}</cbc:StartDate>
              <cbc:EndDate>${tenant?.authorizationEndDate ?? doc.issueDate}</cbc:EndDate>
            </sts:AuthorizationPeriod>
            <sts:AuthorizedInvoices>
              <sts:Prefix>${X(tenant?.authorizationPrefix ?? doc.numberPrefix ?? '')}</sts:Prefix>
              <sts:From>${X(tenant?.authorizationFrom ?? '')}</sts:From>
              <sts:To>${X(tenant?.authorizationTo ?? '')}</sts:To>
            </sts:AuthorizedInvoices>
          </sts:InvoiceControl>
          <sts:InvoiceSource>
            <cbc:IdentificationCode listAgencyID="6"
              listAgencyName="United Nations Economic Commission for Europe"
              listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
          </sts:InvoiceSource>
          <sts:SoftwareProvider>
            <sts:ProviderID schemeAgencyID="195"
              schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"
              schemeID="4" schemeName="31">${X(nitOfe)}</sts:ProviderID>
            <sts:SoftwareID schemeAgencyID="195"
              schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${X(softwareId)}</sts:SoftwareID>
          </sts:SoftwareProvider>
          <sts:SoftwareSecurityCode schemeAgencyID="195"
            schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${ssc}</sts:SoftwareSecurityCode>
          <sts:AuthorizationProvider>
            <sts:AuthorizationProviderID schemeAgencyID="195"
              schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"
              schemeID="4" schemeName="31">800197268</sts:AuthorizationProviderID>
          </sts:AuthorizationProvider>
          <sts:QRCode>${X(qrUrl)}</sts:QRCode>
        </sts:DianExtensions>
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <!-- XAdES-BES signature placeholder — populated in T14.3 (signing step) -->
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ProfileExecutionID>${profileExecId}</cbc:ProfileExecutionID>
  <cbc:ID>${X(numFac)}</cbc:ID>
  <cbc:UUID schemeID="${tipoAmb}" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
  <cbc:IssueDate>${doc.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${horFac}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listAgencyID="6"
    listAgencyName="United Nations Economic Commission for Europe"
    listID="UN/ECE 1001 Invoice Type"
    listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:InvoiceTypeCode-2.1">01</cbc:InvoiceTypeCode>
  <cbc:Note>${X(doc.notes ?? 'Factura de venta')}</cbc:Note>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${lineCount}</cbc:LineCountNumeric>
  ${dueDate(doc)}
  <cac:AccountingSupplierParty>
    <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${X(tenant?.legalName ?? 'Empresa Emisora')}</cbc:Name>
      </cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:CityName>${X(tenant?.city ?? 'Bogotá D.C.')}</cbc:CityName>
          <cbc:CountrySubentity>Bogotá D.C.</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>11</cbc:CountrySubentityCode>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${X(tenant?.legalName ?? 'Empresa Emisora')}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195"
          schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"
          schemeID="${issuerSchemeId}" schemeName="${issuerSchemeId}">${X(nitOfe)}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="48">${taxLevelCode}</cbc:TaxLevelCode>
        <cac:RegistrationAddress>
          <cbc:CityName>${X(tenant?.city ?? 'Bogotá D.C.')}</cbc:CityName>
          <cbc:CountrySubentity>Bogotá D.C.</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>11</cbc:CountrySubentityCode>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:RegistrationAddress>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${X(tenant?.legalName ?? 'Empresa Emisora')}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195"
          schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"
          schemeID="${issuerSchemeId}" schemeName="${issuerSchemeId}">${X(nitOfe)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Telephone>${X(tenant?.phone ?? '')}</cbc:Telephone>
        <cbc:ElectronicMail>${X(tenant?.email ?? '')}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${X(doc.customerSnapshot.legalName)}</cbc:Name>
      </cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:CityName>${X(doc.customerSnapshot.municipality ?? 'Bogotá D.C.')}</cbc:CityName>
          <cbc:CountrySubentity>${X(doc.customerSnapshot.department ?? 'Bogotá D.C.')}</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>11</cbc:CountrySubentityCode>
          <cac:Country>
            <cbc:IdentificationCode>${X(doc.customerSnapshot.country ?? 'CO')}</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${X(doc.customerSnapshot.legalName)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195"
          schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"
          schemeID="${custSchemeId}" schemeName="${custSchemeId}">${X(numAdq)}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode>
        <cac:RegistrationAddress>
          <cbc:CityName>${X(doc.customerSnapshot.municipality ?? 'Bogotá D.C.')}</cbc:CityName>
          <cbc:CountrySubentity>${X(doc.customerSnapshot.department ?? 'Bogotá D.C.')}</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>11</cbc:CountrySubentityCode>
          <cac:Country>
            <cbc:IdentificationCode>${X(doc.customerSnapshot.country ?? 'CO')}</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:RegistrationAddress>
        <cac:TaxScheme>
          <cbc:ID>ZZ</cbc:ID>
          <cbc:Name>No aplica</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${X(doc.customerSnapshot.legalName)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195"
          schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"
          schemeID="${custSchemeId}" schemeName="${custSchemeId}">${X(numAdq)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${X(doc.customerSnapshot.emailPrimary)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:ID>1</cbc:ID>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${doc.dueDate ?? doc.issueDate}</cbc:PaymentDueDate>
    <cbc:PaymentID>Contado</cbc:PaymentID>
  </cac:PaymentMeans>
  ${taxTotals(doc.taxSummary, doc.currency)}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${doc.currency}">${doc.subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${doc.currency}">${doc.subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${doc.currency}">${doc.grandTotal}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${doc.currency}">0.00</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="${doc.currency}">0.00</cbc:ChargeTotalAmount>
    <cbc:PrePaidAmount currencyID="${doc.currency}">0.00</cbc:PrePaidAmount>
    <cbc:PayableAmount currencyID="${doc.currency}">${doc.grandTotal}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${invoiceLines(doc.lines, doc.currency)}
</Invoice>`;

    return Buffer.from(xml, 'utf-8');
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dueDate(doc: DraftDocument): string {
  if (!doc.dueDate) return '';
  return `<cac:InvoicePeriod>
    <cbc:StartDate>${doc.issueDate}</cbc:StartDate>
    <cbc:EndDate>${doc.dueDate}</cbc:EndDate>
  </cac:InvoicePeriod>`;
}

function sumTax(taxes: readonly DraftTaxSummary[], treatments: string[]): string {
  const total = taxes
    .filter((t) => treatments.includes(t.taxTreatment))
    .reduce((acc, t) => acc.plus(t.taxAmount), new Decimal(0));
  return total.toFixed(2);
}

function taxTotals(taxes: readonly DraftTaxSummary[], currency: string): string {
  if (taxes.length === 0) return '';

  // Group by taxRate for TAXED treatments
  const byRate = new Map<number, DraftTaxSummary[]>();
  for (const t of taxes) {
    if (t.taxTreatment === 'TAXED' && new Decimal(t.taxAmount).greaterThan(0)) {
      const bucket = byRate.get(t.taxRate) ?? [];
      bucket.push(t);
      byRate.set(t.taxRate, bucket);
    }
  }
  if (byRate.size === 0) return '';

  const totalTax = [...byRate.values()].flat()
    .reduce((a, t) => a.plus(t.taxAmount), new Decimal(0)).toFixed(2);

  const subtotals = [...byRate.entries()].map(([rate, items]) => {
    const taxable = items.reduce((a, t) => a.plus(t.taxableBase), new Decimal(0)).toFixed(2);
    const taxAmt = items.reduce((a, t) => a.plus(t.taxAmount), new Decimal(0)).toFixed(2);
    return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${taxable}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${taxAmt}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${rate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
  }).join('\n');

  return `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${totalTax}</cbc:TaxAmount>
${subtotals}
  </cac:TaxTotal>`;
}

function invoiceLines(lines: readonly DraftLine[], currency: string): string {
  return lines.map((l, i) => {
    const hasTax = l.taxTreatment === 'TAXED' && new Decimal(l.taxAmount).greaterThan(0);
    const lineTaxBlock = hasTax ? `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${currency}">${l.taxAmount}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${currency}">${l.taxableBase}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${currency}">${l.taxAmount}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${l.taxRate.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>01</cbc:ID>
            <cbc:Name>IVA</cbc:Name>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>` : '';

    return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="94">${new Decimal(l.quantity).toFixed(6)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${new Decimal(l.grossAmount).minus(l.discountAmount).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:FreeOfChargeIndicator>false</cbc:FreeOfChargeIndicator>
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>Descuento comercial</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="${currency}">${l.discountAmount}</cbc:Amount>
      <cbc:BaseAmount currencyID="${currency}">${l.grossAmount}</cbc:BaseAmount>
    </cac:AllowanceCharge>${lineTaxBlock}
    <cac:Item>
      <cbc:Description>${X(l.description)}</cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${X(l.productId ?? `LINE-${i + 1}`)}</cbc:ID>
      </cac:SellersItemIdentification>
      <cac:StandardItemIdentification>
        <cbc:ID schemeID="999" schemeName="UNSPSC">00000000</cbc:ID>
      </cac:StandardItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${l.unitPrice}</cbc:PriceAmount>
      <cbc:BaseQuantity unitCode="94">1.000000</cbc:BaseQuantity>
    </cac:Price>
  </cac:InvoiceLine>`;
  }).join('\n');
}
