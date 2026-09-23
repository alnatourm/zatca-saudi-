import QRCode from 'qrcode';

export interface ZATCA9TagInput {
  sellerName: string; // Tag 1: Seller's Name
  vatNumber: string; // Tag 2: VAT Registration Number (15 digits)
  timestamp: string; // Tag 3: ISO 8601 Timestamp
  totalAmount: string; // Tag 4: Total Invoice Amount with VAT (SAR)
  vatAmount: string; // Tag 5: Total VAT Amount (SAR)
  xmlHash: string; // Tag 6: SHA-256 Digest of UBL XML (Base64)
  ecdsaSignature: string; // Tag 7: ECDSA Digital Signature (Base64)
  publicKey: string; // Tag 8: EGS ECDSA Public Key (Base64/PEM)
  certificateStamp: string; // Tag 9: CSID Certificate Signature (Base64)
}

/**
 * Encodes a single ZATCA Tag-Length-Value (TLV) entry into a Buffer.
 * Tag: 1 byte
 * Length: 1 byte
 * Value: N bytes (UTF-8 encoded)
 */
export function encodeTLVTag(tag: number, value: string | Buffer): Buffer {
  const valBuf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  const len = valBuf.length;

  const buf = Buffer.alloc(2 + len);
  buf.writeUInt8(tag, 0);
  buf.writeUInt8(Math.min(len, 255), 1);
  valBuf.copy(buf, 2, 0, Math.min(len, 255));
  return buf;
}

/**
 * ZATCA Phase 2 9-Tag TLV Encoder.
 * Converts Seller Name, VAT Number, ISO timestamp, Total Amount, VAT Amount,
 * XML Hash, ECDSA Signature, Public Key, and Certificate Stamp into a Base64 TLV string.
 */
export function generateZATCA9TagTLVBase64(input: ZATCA9TagInput): string {
  const tagList = [
    { tag: 1, val: input.sellerName },
    { tag: 2, val: input.vatNumber },
    { tag: 3, val: input.timestamp },
    { tag: 4, val: input.totalAmount },
    { tag: 5, val: input.vatAmount },
    { tag: 6, val: input.xmlHash },
    { tag: 7, val: input.ecdsaSignature },
    { tag: 8, val: input.publicKey },
    { tag: 9, val: input.certificateStamp },
  ];

  const buffers = tagList.map(({ tag, val }) => encodeTLVTag(tag, val));
  const combined = Buffer.concat(buffers);
  return combined.toString('base64');
}

/**
 * Renders the Base64 TLV string as a QR Code PNG Data URL using the `qrcode` npm package.
 */
export async function renderQRCodeDataUrl(base64TLV: string): Promise<string> {
  return QRCode.toDataURL(base64TLV, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Complete ZATCA Phase 2 QR Utility wrapper.
 * Encodes the 9 tags to Base64 TLV and renders the QR code Data URL in a single call.
 */
export async function generateAndRenderZATCAQR(input: ZATCA9TagInput): Promise<{
  base64TLV: string;
  dataUrl: string;
}> {
  const base64TLV = generateZATCA9TagTLVBase64(input);
  const dataUrl = await renderQRCodeDataUrl(base64TLV);
  return { base64TLV, dataUrl };
}
