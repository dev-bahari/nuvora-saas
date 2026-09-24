import forge from 'node-forge';
import { randomUUID } from 'node:crypto';
import { SignedXml } from 'xml-crypto';
import type { DianSigningCredentials } from './pfx-chain-loader.service.js';

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const POLICY = 'https://facturaelectronica.dian.gov.co/politicadefirma/v1/politicadefirmav2.pdf';
const POLICY_HASH = 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y=';

export class XadesSignerService {
  sign(xml: Buffer, credentials: DianSigningCredentials, signingTime = new Date().toISOString()): Buffer {
    const signatureId = `xmldsig-${randomUUID()}`;
    const propsId = `${signatureId}-signedprops`;
    const xades = `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${signatureId}"><xades:SignedProperties Id="${propsId}"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate>${credentials.certificates.map(certXml).join('')}</xades:SigningCertificate><xades:SignaturePolicyIdentifier><xades:SignaturePolicyId><xades:SigPolicyId><xades:Identifier>${POLICY}</xades:Identifier></xades:SigPolicyId><xades:SigPolicyHash><ds:DigestMethod xmlns:ds="${DS}" Algorithm="${SHA256}"/><ds:DigestValue xmlns:ds="${DS}">${POLICY_HASH}</ds:DigestValue></xades:SigPolicyHash></xades:SignaturePolicyId></xades:SignaturePolicyIdentifier><xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>supplier</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole></xades:SignedSignatureProperties></xades:SignedProperties></xades:QualifyingProperties>`;
    const signer = new SignedXml({
      privateKey: credentials.privateKeyPem,
      publicCert: credentials.certificatePem,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm: C14N,
      getKeyInfoContent: () => `<ds:X509Data>${credentials.certificates.map((cert) => `<ds:X509Certificate>${pemBody(forge.pki.certificateToPem(cert))}</ds:X509Certificate>`).join('')}</ds:X509Data>`,
    });
    signer.keyInfoAttributes = { Id: `${signatureId}-keyinfo` };
    signer.objects = [{ content: xades, attributes: { Id: `${signatureId}-object` } }];
    signer.addReference({ xpath: "/*[local-name()='Invoice' or local-name()='CreditNote' or local-name()='DebitNote']", transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', C14N], digestAlgorithm: SHA256, isEmptyUri: true });
    signer.addReference({ xpath: `//*[@Id='${propsId}']`, transforms: [C14N], digestAlgorithm: SHA256, uri: propsId, type: 'http://uri.etsi.org/01903#SignedProperties' });
    signer.computeSignature(xml.toString(), {
      attrs: { Id: signatureId }, prefix: 'ds',
      location: { reference: "//*[local-name()='UBLExtension'][2]/*[local-name()='ExtensionContent']", action: 'append' },
    });
    return Buffer.from(signer.getSignedXml());
  }
}

function certXml(cert: forge.pki.Certificate): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const digest = forge.util.encode64(forge.md.sha256.create().update(der).digest().getBytes());
  const issuer = cert.issuer.attributes.map((attribute) => `${attribute.shortName ?? attribute.name}=${attribute.value}`).join(',');
  return `<xades:Cert><xades:CertDigest><ds:DigestMethod xmlns:ds="${DS}" Algorithm="${SHA256}"/><ds:DigestValue xmlns:ds="${DS}">${digest}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName xmlns:ds="${DS}">${escapeXml(issuer)}</ds:X509IssuerName><ds:X509SerialNumber xmlns:ds="${DS}">${BigInt(`0x${cert.serialNumber}`).toString()}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert>`;
}

function pemBody(pem: string) { return pem.replace(/-----[^-]+-----|\s/g, ''); }
function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!); }
