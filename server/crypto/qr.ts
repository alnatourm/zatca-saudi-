function encodeTlv(tag: number, value: string | Buffer): Buffer {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return Buffer.concat([Buffer.from([tag]), Buffer.from([buf.length]), buf]);
}

export interface ZatcaPhase2QrData {
  sellerName: string;
  vatNumber: string;
  timestamp: string;      // ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
  totalWithVat: string;   // e.g. "115.00"
  vatAmount: string;      // e.g. "15.00"
  xmlHash: string;        // Base64 SHA-256 digest of invoice
  signature: Buffer;      // ECDSA secp256k1 signature
  publicKey: Buffer;      // ECDSA public key
  certStamp: Buffer;      // ZATCA Certificate Signature
}

/**
 * Builds the ZATCA Phase 2 9-Tag TLV Base64 QR code string.
 */
export function buildZatcaPhase2Qr(data: ZatcaPhase2QrData): string {
  const tags = [
    encodeTlv(1, data.sellerName),
    encodeTlv(2, data.vatNumber),
    encodeTlv(3, data.timestamp),
    encodeTlv(4, data.totalWithVat),
    encodeTlv(5, data.vatAmount),
    encodeTlv(6, data.xmlHash),
    encodeTlv(7, data.signature),
    encodeTlv(8, data.publicKey),
    encodeTlv(9, data.certStamp)
  ];
  return Buffer.concat(tags).toString('base64');
}
