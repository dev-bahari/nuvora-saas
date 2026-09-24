import { createHash } from 'node:crypto';
import forge from 'node-forge';

export interface DianSigningCredentials {
  privateKeyPem: string;
  certificates: forge.pki.Certificate[];
  certificatePem: string;
  chainPem: string;
  fingerprint: string;
  expiresAt: Date;
}

export class PfxChainLoaderService {
  load(pfx: Buffer, password: string, externalChain?: Buffer): DianSigningCredentials {
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), password);
    const keyTypes = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag].filter((type): type is string => Boolean(type));
    const keyBag = keyTypes
      .flatMap((type) => p12.getBags({ bagType: type })[type] ?? [])
      .find((bag) => bag.key)?.key;
    if (!keyBag) throw new Error('El PFX no contiene una llave privada');

    const certBagType = forge.pki.oids.certBag!;
    const embedded = (p12.getBags({ bagType: certBagType })[certBagType] ?? [])
      .map((bag: forge.pkcs12.Bag) => bag.cert).filter((cert): cert is forge.pki.Certificate => Boolean(cert));
    const extra = externalChain ? parseCertificates(externalChain) : [];
    const all = [...embedded, ...extra];
    const leaf = all.find((cert) => !isCa(cert)) ?? all[0];
    if (!leaf) throw new Error('El PFX no contiene el certificado firmante');

    const chain = [leaf];
    while (chain.length < 3) {
      const current = chain.at(-1)!;
      const issuer = all.find((candidate) => candidate !== current && candidate.subject.hash === current.issuer.hash);
      if (!issuer || chain.includes(issuer)) break;
      chain.push(issuer);
    }
    if (chain.length < 3) throw new Error('Se requieren certificado firmante, CA intermedia y CA raíz');
    const privateKey = keyBag as forge.pki.rsa.PrivateKey;
    const publicKey = leaf.publicKey as forge.pki.rsa.PublicKey;
    if (privateKey.n.compareTo(publicKey.n) !== 0 || privateKey.e.compareTo(publicKey.e) !== 0) throw new Error('La llave privada no corresponde al certificado firmante');
    if (!isCa(chain[1]!) || !isCa(chain[2]!)) throw new Error('La cadena no contiene CA intermedia y raíz válidas');
    if (!chain[1]!.verify(chain[0]!) || !chain[2]!.verify(chain[1]!)) throw new Error('La cadena de certificados tiene una firma inválida');
    if (chain[2]!.issuer.hash !== chain[2]!.subject.hash || !chain[2]!.verify(chain[2]!)) throw new Error('La CA raíz no es autofirmada o no es confiable');
    const now = new Date();
    for (const cert of chain) if (cert.validity.notBefore > now || cert.validity.notAfter < now) throw new Error('La cadena contiene un certificado vencido o aún no válido');

    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(leaf)).getBytes();
    const fingerprint = createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex').toUpperCase().match(/.{2}/g)!.join(':');
    return {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag), certificates: chain,
      certificatePem: forge.pki.certificateToPem(leaf),
      chainPem: chain.map(forge.pki.certificateToPem).join(''), fingerprint, expiresAt: leaf.validity.notAfter,
    };
  }
}

function isCa(cert: forge.pki.Certificate): boolean {
  return Boolean(cert.getExtension('basicConstraints') && (cert.getExtension('basicConstraints') as { cA?: boolean }).cA);
}

function parseCertificates(input: Buffer): forge.pki.Certificate[] {
  const text = input.toString('utf8');
  const pem = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (pem) return pem.map((value) => forge.pki.certificateFromPem(value));
  return [forge.pki.certificateFromAsn1(forge.asn1.fromDer(input.toString('binary')))];
}
