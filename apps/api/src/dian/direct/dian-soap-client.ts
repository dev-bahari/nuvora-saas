import { DianResponseParser, type ParsedDianResponse } from './dian-response-parser.js';
import { SignedXml } from 'xml-crypto';
import type { DianSigningCredentials } from '../signing/pfx-chain-loader.service.js';
import { randomUUID } from 'node:crypto';

const ENDPOINT = 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc';
const ACTION = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync';

export class DianSoapClient {
  constructor(private readonly request: typeof fetch = fetch, private readonly parser = new DianResponseParser()) {}

  async sendTestSetAsync(input: { zipBase64: string; testSetId: string; credentials?: DianSigningCredentials }): Promise<ParsedDianResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const body = input.credentials ? signedEnvelope(input, input.credentials) : envelope(input);
      const response = await this.request(ENDPOINT, { method: 'POST', headers: { 'content-type': `application/soap+xml;charset=UTF-8;action="${ACTION}"` }, body, signal: controller.signal });
      const xml = await response.text();
      const parsed = this.parser.parse(xml);
      if (!response.ok && parsed.outcome !== 'ERROR') return { ...parsed, outcome: 'ERROR', message: `DIAN HTTP ${response.status}: ${parsed.message}` };
      return parsed;
    } finally { clearTimeout(timeout); }
  }
}

function envelope(input: { zipBase64: string; testSetId: string }) {
  return `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia"><s:Header/><s:Body><wcf:SendTestSetAsync><wcf:fileName>documentos.zip</wcf:fileName><wcf:contentFile>${input.zipBase64}</wcf:contentFile><wcf:testSetId>${escapeXml(input.testSetId)}</wcf:testSetId></wcf:SendTestSetAsync></s:Body></s:Envelope>`;
}

function signedEnvelope(input: { zipBase64: string; testSetId: string }, credentials: DianSigningCredentials) {
  const now = new Date(); const expires = new Date(now.getTime() + 5 * 60_000); const tokenId = `X509-${randomUUID()}`;
  const xml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><s:Header><wsse:Security s:mustUnderstand="1"><wsu:Timestamp wsu:Id="TS"><wsu:Created>${now.toISOString()}</wsu:Created><wsu:Expires>${expires.toISOString()}</wsu:Expires></wsu:Timestamp><wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" wsu:Id="${tokenId}">${credentials.certificatePem.replace(/-----[^-]+-----|\s/g, '')}</wsse:BinarySecurityToken></wsse:Security></s:Header><s:Body wsu:Id="Body"><wcf:SendTestSetAsync><wcf:fileName>documentos.zip</wcf:fileName><wcf:contentFile>${input.zipBase64}</wcf:contentFile><wcf:testSetId>${escapeXml(input.testSetId)}</wcf:testSetId></wcf:SendTestSetAsync></s:Body></s:Envelope>`;
  const signer = new SignedXml({ privateKey: credentials.privateKeyPem, publicCert: credentials.certificatePem, signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#', getKeyInfoContent: () => `<wsse:SecurityTokenReference><wsse:Reference URI="#${tokenId}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/></wsse:SecurityTokenReference>` });
  signer.idMode = 'wssecurity';
  for (const target of ['Body', 'TS']) signer.addReference({ xpath: `//*[@wsu:Id='${target}']`, transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256', uri: `#${target}` });
  signer.computeSignature(xml, { prefix: 'ds', existingPrefixes: { wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd', wsu: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd' }, location: { reference: "//*[local-name()='Security']", action: 'append' } });
  return signer.getSignedXml();
}

function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!); }
