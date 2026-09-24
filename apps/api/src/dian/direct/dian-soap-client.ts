import { randomUUID } from 'node:crypto';
import { SignedXml } from 'xml-crypto';
import type { DianSigningCredentials } from '../signing/pfx-chain-loader.service.js';
import { DianResponseParser, type ParsedDianResponse } from './dian-response-parser.js';

const ENDPOINT = 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc';
const SEND_ACTION = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync';
const STATUS_ACTION = 'http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatusZip';

export class DianSoapClient {
  constructor(private readonly request: typeof fetch = fetch, private readonly parser = new DianResponseParser()) {}
  sendTestSetAsync(input: { zipBase64: string; testSetId: string; credentials?: DianSigningCredentials }) {
    const operation = `<wcf:SendTestSetAsync><wcf:fileName>documentos.zip</wcf:fileName><wcf:contentFile>${input.zipBase64}</wcf:contentFile><wcf:testSetId>${escapeXml(input.testSetId)}</wcf:testSetId></wcf:SendTestSetAsync>`;
    return this.call(SEND_ACTION, input.credentials ? signedEnvelope(operation, SEND_ACTION, input.credentials) : plainEnvelope(operation));
  }
  getStatusZip(input: { trackId: string; credentials: DianSigningCredentials }) {
    const operation = `<wcf:GetStatusZip><wcf:trackId>${escapeXml(input.trackId)}</wcf:trackId></wcf:GetStatusZip>`;
    return this.call(STATUS_ACTION, signedEnvelope(operation, STATUS_ACTION, input.credentials));
  }
  private async call(action: string, body: string): Promise<ParsedDianResponse> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await this.request(ENDPOINT, { method: 'POST', headers: { 'content-type': `application/soap+xml;charset=UTF-8;action="${action}"` }, body, signal: controller.signal });
      const xml = await response.text(); const parsed = this.parser.parse(xml);
      return !response.ok && parsed.outcome !== 'ERROR' ? { ...parsed, outcome: 'ERROR', message: `DIAN HTTP ${response.status}: ${parsed.message}` } : parsed;
    } finally { clearTimeout(timeout); }
  }
}

function plainEnvelope(operation: string) { return `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia"><s:Header/><s:Body>${operation}</s:Body></s:Envelope>`; }
function signedEnvelope(operation: string, action: string, credentials: DianSigningCredentials) {
  const now = new Date(); const expires = new Date(now.getTime() + 300_000); const tokenId = `X509-${randomUUID()}`;
  const xml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia" xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><s:Header><a:Action s:mustUnderstand="1" wsu:Id="Action">${action}</a:Action><a:MessageID wsu:Id="MessageID">urn:uuid:${randomUUID()}</a:MessageID><a:ReplyTo wsu:Id="ReplyTo"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo><a:To s:mustUnderstand="1" wsu:Id="To">${ENDPOINT}</a:To><wsse:Security s:mustUnderstand="1"><wsu:Timestamp wsu:Id="TS"><wsu:Created>${now.toISOString()}</wsu:Created><wsu:Expires>${expires.toISOString()}</wsu:Expires></wsu:Timestamp><wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" wsu:Id="${tokenId}">${credentials.certificatePem.replace(/-----[^-]+-----|\s/g, '')}</wsse:BinarySecurityToken></wsse:Security></s:Header><s:Body wsu:Id="Body">${operation}</s:Body></s:Envelope>`;
  const signer = new SignedXml({ privateKey: credentials.privateKeyPem, publicCert: credentials.certificatePem, signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#', getKeyInfoContent: () => `<wsse:SecurityTokenReference><wsse:Reference URI="#${tokenId}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/></wsse:SecurityTokenReference>` });
  signer.idMode = 'wssecurity';
  for (const id of ['Body', 'TS', 'Action', 'MessageID', 'ReplyTo', 'To']) signer.addReference({ xpath: `//*[@wsu:Id='${id}']`, transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256', uri: `#${id}` });
  signer.computeSignature(xml, { prefix: 'ds', existingPrefixes: { wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd', wsu: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd' }, location: { reference: "//*[local-name()='Security']", action: 'append' } });
  return signer.getSignedXml();
}
function escapeXml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!); }
