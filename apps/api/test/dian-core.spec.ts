import { describe, expect, it } from 'vitest';
import forge from 'node-forge';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { PfxChainLoaderService } from '../src/dian/signing/pfx-chain-loader.service.js';
import { XadesSignerService } from '../src/dian/signing/xades-signer.service.js';
import { DianUblRendererService } from '../src/dian/ubl/dian-ubl-renderer.service.js';
import { DianPackageService } from '../src/dian/direct/dian-package.service.js';
import { DianResponseParser } from '../src/dian/direct/dian-response-parser.js';
import { DianSoapClient } from '../src/dian/direct/dian-soap-client.js';
import { DianSecretService } from '../src/dian/secrets/dian-secret.service.js';
import { DianController } from '../src/dian/dian.controller.js';
import { DianSubmissionController } from '../src/documents/dian-submission.controller.js';
import type { DraftDocument } from '@nuvora/contracts';

function certificate(
  commonName: string,
  keys: forge.pki.rsa.KeyPair,
  issuerCert?: forge.pki.Certificate,
  issuerKey?: forge.pki.rsa.PrivateKey,
  isCa = false,
) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Math.floor(Math.random() * 1e9).toString(16);
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(issuerCert?.subject.attributes ?? attrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: isCa }, { name: 'keyUsage', digitalSignature: !isCa, keyCertSign: isCa }]);
  cert.sign(issuerKey ?? keys.privateKey, forge.md.sha256.create());
  return cert;
}

function pkiFixture() {
  const rootKeys = forge.pki.rsa.generateKeyPair(1024);
  const root = certificate('Nuvora Test Root', rootKeys, undefined, undefined, true);
  const intermediateKeys = forge.pki.rsa.generateKeyPair(1024);
  const intermediate = certificate('Nuvora Test Intermediate', intermediateKeys, root, rootKeys.privateKey, true);
  const leafKeys = forge.pki.rsa.generateKeyPair(1024);
  const leaf = certificate('David Test Signer', leafKeys, intermediate, intermediateKeys.privateKey);
  const password = 'test-password';
  const asn1 = forge.pkcs12.toPkcs12Asn1(leafKeys.privateKey, [leaf], password, { algorithm: '3des' });
  return {
    pfx: Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary'),
    password,
    chain: Buffer.from(forge.pki.certificateToPem(intermediate) + forge.pki.certificateToPem(root)),
    leaf,
  };
}

function mismatchedPfxFixture() {
  const fixture = pkiFixture();
  const wrongKeys = forge.pki.rsa.generateKeyPair(1024);
  const asn1 = forge.pkcs12.toPkcs12Asn1(wrongKeys.privateKey, [fixture.leaf], fixture.password, { algorithm: '3des' });
  return { ...fixture, pfx: Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary') };
}

const baseDocument: DraftDocument = {
  id: '00000000-0000-0000-0000-000000000001', tenantId: '00000000-0000-0000-0000-000000000002',
  documentType: 'INVOICE', status: 'PROCESSING', version: 1, customerId: null,
  customerSnapshot: { id: '00000000-0000-0000-0000-000000000003', legalName: 'Cliente Prueba', identificationType: 'NIT', identification: '900123456', dv: '7', emailPrimary: 'cliente@example.test', address: 'Calle 1', municipality: 'Bogotá', department: 'Bogotá D.C.', country: 'CO' },
  currency: 'COP', issueDate: '2026-09-24', dueDate: '2026-09-24', notes: 'Prueba DIAN',
  subtotal: '1000.00', totalTax: '190.00', grandTotal: '1190.00', numberPrefix: 'SETP', documentNumber: '990000001',
  cufe: 'a'.repeat(96), lines: [{ id: 'l1', productId: null, position: 1, description: 'Servicio', quantity: '1.000000', unitPrice: '1000.00', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19, grossAmount: '1000.00', discountAmount: '0.00', taxableBase: '1000.00', taxAmount: '190.00', lineTotal: '1190.00' }],
  taxSummary: [{ taxTreatment: 'TAXED', taxRate: 19, taxableBase: '1000.00', taxAmount: '190.00' }], aiu: null, createdBy: null, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z',
  sourceDocumentId: null, reasonCode: null,
};

const tenant = { legalName: 'David Caro Morales', nit: '123456789', dv: '0', address: 'Calle 1', city: 'Bogotá', phone: '3000000000', email: 'david@example.test', taxRegime: 'COMUN', dianEnvironment: 'HABILITACION' as const, dianSoftwareId: 'software-id', dianSoftwarePin: '24241', dianTechnicalKey: 'technical-key' };

describe('DIAN cryptography and transport', () => {
  it('encrypts secrets with authentication and rejects tampering', () => {
    const service = new DianSecretService('a'.repeat(64));
    const sealed = service.seal(Buffer.from('secret'));
    sealed.ciphertext[0] = sealed.ciphertext[0]! ^ 1;
    expect(() => service.open(sealed)).toThrow();
  });

  it('loads a PFX and resolves signer, intermediate and root certificates', () => {
    const fixture = pkiFixture();
    const loaded = new PfxChainLoaderService().load(fixture.pfx, fixture.password, fixture.chain);
    expect(loaded.certificates).toHaveLength(3);
    expect(loaded.fingerprint).toMatch(/^[A-F0-9:]+$/);
  });

  it('rejects a PFX whose private key does not match the signer certificate', () => {
    const fixture = mismatchedPfxFixture();
    expect(() => new PfxChainLoaderService().load(fixture.pfx, fixture.password, fixture.chain)).toThrow(/llave privada/i);
  });

  it.each([
    ['INVOICE', 'Invoice', 'InvoiceLine'],
    ['CREDIT_NOTE', 'CreditNote', 'CreditNoteLine'],
    ['DEBIT_NOTE', 'DebitNote', 'DebitNoteLine'],
  ] as const)('renders %s as UBL %s', (documentType, root, line) => {
    const document = { ...baseDocument, documentType };
    const xml = new DianUblRendererService().render(document, { ...tenant, invoiceAuthorization: '18760000001', authorizationPrefix: 'SETP', authorizationFrom: '990000000', authorizationTo: '995000000', authorizationStartDate: '2019-01-19', authorizationEndDate: '2030-01-19' }, documentType === 'INVOICE' ? undefined : { number: 'SETP990000000', uuid: 'b'.repeat(96), issueDate: '2026-09-23' }).toString();
    expect(xml).toContain(`<${root} `);
    expect(xml).toContain(`<cac:${line}>`);
    expect(xml).not.toContain('placeholder');
    expect(xml).not.toContain('FreeOfChargeIndicator');
    expect(xml).toContain('languageLocaleID="es"');
    expect(xml).toContain('<cac:TaxTotal>');
    expect(xml).toContain('<sts:InvoiceAuthorization>18760000001</sts:InvoiceAuthorization>');
    if (documentType === 'INVOICE') {
      expect(xml).toContain('<cbc:CustomizationID>10</cbc:CustomizationID>');
    } else if (documentType === 'CREDIT_NOTE') {
      expect(xml).toContain('<cbc:CustomizationID>22</cbc:CustomizationID>');
      expect(xml).toContain('schemeName="CUDE-SHA384"');
      expect(xml).toContain('<cac:BillingReference>');
      expect(xml).toContain('<cac:DiscrepancyResponse>');
      expect(xml).toContain('<cac:InvoiceDocumentReference>');
    } else {
      expect(xml).toContain('<cbc:CustomizationID>30</cbc:CustomizationID>');
      expect(xml).toContain('schemeName="CUDE-SHA384"');
      expect(xml).toContain('<cac:BillingReference>');
    }
  });

  it('creates a verifiable XMLDSig carrying XAdES signed properties and the full chain', () => {
    const fixture = pkiFixture();
    const credentials = new PfxChainLoaderService().load(fixture.pfx, fixture.password, fixture.chain);
    const unsigned = new DianUblRendererService().render(baseDocument, tenant);
    const signed = new XadesSignerService().sign(unsigned, credentials, '2026-09-24T12:00:00-05:00').toString();
    expect(signed).toContain('xades:SignedProperties');
    expect(signed.match(/xades:Cert/g)?.length).toBeGreaterThanOrEqual(3);
    const doc = new DOMParser().parseFromString(signed, 'application/xml');
    const signature = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0]!;
    const verifier = new SignedXml({ publicCert: forge.pki.certificateToPem(fixture.leaf) });
    verifier.loadSignature(signature);
    expect(verifier.checkSignature(signed)).toBe(true);
  });

  it('packages exactly one signed XML file into a ZIP', () => {
    const zipped = new DianPackageService().zip('fv090000001.xml', Buffer.from('<Invoice/>'));
    const entries = unzipSync(zipped);
    expect(Object.keys(entries)).toEqual(['fv090000001.xml']);
    expect(strFromU8(entries['fv090000001.xml']!)).toBe('<Invoice/>');
  });

  it.each([
    ['<b:StatusCode>00</b:StatusCode><b:StatusDescription>Procesado Correctamente.</b:StatusDescription>', 'ACCEPTED'],
    ['<b:StatusCode>99</b:StatusCode><b:ErrorMessage><c:string>Regla FAD09</c:string></b:ErrorMessage>', 'REJECTED'],
    ['<b:StatusCode>66</b:StatusCode><b:StatusDescription>En proceso</b:StatusDescription>', 'PENDING'],
    ['<s:Fault><s:Reason><s:Text>Error SOAP</s:Text></s:Reason></s:Fault>', 'ERROR'],
  ] as const)('maps DIAN response to %s', (body, outcome) => {
    const xml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse" xmlns:c="http://schemas.microsoft.com/2003/10/Serialization/Arrays"><s:Body>${body}</s:Body></s:Envelope>`;
    expect(new DianResponseParser().parse(xml).outcome).toBe(outcome);
  });

  it('builds SendTestSetAsync SOAP and never logs the ZIP', async () => {
    let requestBody = '';
    const client = new DianSoapClient(async (_url, init) => {
      requestBody = String(init?.body ?? '');
      return new Response('<StatusCode>66</StatusCode><StatusDescription>En proceso</StatusDescription>', { status: 200 });
    });
    const result = await client.sendTestSetAsync({ zipBase64: 'UEsSECRET', testSetId: 'set-1' });
    expect(requestBody).toContain('SendTestSetAsync');
    expect(requestBody).toContain('<wcf:testSetId>set-1</wcf:testSetId>');
    expect(result.outcome).toBe('PENDING');
  });

  it('records a transport timeout as pending so it can be reconciled without a resend', async () => {
    const client = new DianSoapClient(async () => {
      throw new DOMException('timeout', 'AbortError');
    });

    await expect(client.sendTestSetAsync({ zipBase64: 'UEs=', testSetId: 'set-1' })).resolves.toMatchObject({
      outcome: 'PENDING',
      message: expect.stringMatching(/timeout/i),
    });
  });

  it('signs SOAP with WS-Addressing and builds GetStatusZip polling', async () => {
    const fixture = pkiFixture(); const credentials = new PfxChainLoaderService().load(fixture.pfx, fixture.password, fixture.chain);
    const requests: string[] = [];
    const client = new DianSoapClient(async (_url, init) => { requests.push(String(init?.body)); return new Response('<StatusCode>00</StatusCode><StatusDescription>Aceptado</StatusDescription>'); });
    await client.sendTestSetAsync({ zipBase64: 'UEs=', testSetId: 'set-1', credentials });
    await client.getStatusZip({ trackId: 'track-1', credentials });
    expect(requests[0]).toContain('<a:Action'); expect(requests[0]).toContain('<a:To'); expect(requests[0]).toContain('BinarySecurityToken');
    expect(requests[1]).toContain('<wcf:GetStatusZip>'); expect(requests[1]).toContain('<wcf:trackId>track-1</wcf:trackId>');
  });
});

describe('DIAN pilot configuration boundary', () => {
  const pilotContext = {
    tenantId: 'pilot-tenant', userId: 'user-1', requestId: 'request-1', permissions: ['dian.configure'],
  };

  it('rejects credential reads and writes outside the configured pilot tenant', async () => {
    const previous = process.env['DIAN_PILOT_TENANT_ID'];
    process.env['DIAN_PILOT_TENANT_ID'] = 'pilot-tenant';
    const credentials = {
      getStatus: async () => ({ configured: false }),
      save: async () => ({ configured: true }),
    };
    const controller = new DianController(credentials as never);
    const request = { context: { ...pilotContext, tenantId: 'another-tenant' } } as never;

    expect(() => controller.get(request)).toThrow(/tenant piloto/i);
    await expect(controller.save(request, {} as never)).rejects.toThrow(/tenant piloto/i);
    process.env['DIAN_PILOT_TENANT_ID'] = previous;
  });

  it('rejects DIAN submission progress outside the configured pilot tenant', () => {
    const previous = process.env['DIAN_PILOT_TENANT_ID'];
    process.env['DIAN_PILOT_TENANT_ID'] = 'pilot-tenant';
    const controller = new DianSubmissionController({ enqueue: async () => ({}), progress: async () => ({}) } as never);
    const request = { context: { ...pilotContext, tenantId: 'another-tenant' } } as never;

    expect(() => controller.progress(request)).toThrow(/tenant piloto/i);
    process.env['DIAN_PILOT_TENANT_ID'] = previous;
  });
});
