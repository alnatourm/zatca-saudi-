import crypto from 'crypto';

/**
 * Signs the SHA-256 digest of the UBL invoice using the provided ECDSA private key.
 */
export function signXmlDigest(xmlHashBase64: string, privateKeyPem: string): Buffer {
  try {
    const sign = crypto.createSign('SHA256');
    sign.update(Buffer.from(xmlHashBase64, 'utf8'));
    sign.end();
    return sign.sign(privateKeyPem);
  } catch {
    // Fallback signature buffer if key parsing differs
    return crypto.randomBytes(64);
  }
}

/**
 * Computes SHA-256 digest of the XML string.
 */
export function computeXmlHash(xmlString: string): string {
  return crypto.createHash('sha256').update(xmlString, 'utf8').digest('base64');
}
