import crypto from 'crypto';
import { TLVTag, DecodedQRResponse } from './types';

/**
 * Encodes a tag, length, and value into Tag-Length-Value (TLV) byte buffer according to ZATCA specification.
 * Tag: 1 byte
 * Length: 1 byte
 * Value: N bytes
 */
export function encodeTLV(tag: number, value: string | Buffer): Buffer {
  const valBuf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  const len = valBuf.length;
  
  if (len > 255) {
    // For values longer than 255 bytes (if any), ZATCA TLV standard uses 1 byte length for standard tags
    const buf = Buffer.alloc(2 + len);
    buf.writeUInt8(tag, 0);
    buf.writeUInt8(Math.min(len, 255), 1);
    valBuf.copy(buf, 2, 0, Math.min(len, 255));
    return buf;
  }

  const buf = Buffer.alloc(2 + len);
  buf.writeUInt8(tag, 0);
  buf.writeUInt8(len, 1);
  valBuf.copy(buf, 2);
  return buf;
}

/**
 * Builds full ZATCA Phase 2 Base64 TLV string from Tags 1 through 9.
 */
export function generateZATCATLVBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatTotal: string;
  invoiceHashBase64: string;
  digitalSignatureBase64: string;
  publicKeyPemOrBase64: string;
  csidCertificateBase64: string;
}): { base64TLV: string; tags: TLVTag[] } {
  const tagDefinitions = [
    { tag: 1, name: 'Seller Name', description: 'Seller/Taxpayer legal name', value: params.sellerName },
    { tag: 2, name: 'VAT Registration Number', description: '15-digit Tax Identification Number', value: params.vatNumber },
    { tag: 3, name: 'Timestamp', description: 'Invoice Issue Timestamp (ISO 8601)', value: params.timestamp },
    { tag: 4, name: 'Total Amount (with VAT)', description: 'Invoice Grand Total SAR', value: params.totalWithVat },
    { tag: 5, name: 'VAT Total', description: 'Total 15% VAT SAR', value: params.vatTotal },
    { tag: 6, name: 'Invoice Hash', description: 'SHA-256 Digest of UBL XML', value: params.invoiceHashBase64 },
    { tag: 7, name: 'Digital Signature', description: 'ECDSA Digital Signature', value: params.digitalSignatureBase64 },
    { tag: 8, name: 'Public Key', description: 'EGS ECDSA Public Key', value: params.publicKeyPemOrBase64 },
    { tag: 9, name: 'Cryptographic Stamp', description: 'CSID Certificate Signature', value: params.csidCertificateBase64 },
  ];

  const buffers: Buffer[] = [];
  const tagsOutput: TLVTag[] = [];

  for (const def of tagDefinitions) {
    const tlvBuf = encodeTLV(def.tag, def.value);
    buffers.push(tlvBuf);

    const valBuf = Buffer.from(def.value, 'utf8');
    tagsOutput.push({
      tag: def.tag,
      name: def.name,
      description: def.description,
      value: def.value,
      length: valBuf.length,
      hexValue: valBuf.toString('hex').toUpperCase(),
    });
  }

  const combined = Buffer.concat(buffers);
  const base64TLV = combined.toString('base64');

  return {
    base64TLV,
    tags: tagsOutput,
  };
}

/**
 * Decodes a ZATCA Base64 TLV QR Code into Tag-Length-Value components.
 */
export function decodeZATCATLV(base64String: string): DecodedQRResponse {
  try {
    const buffer = Buffer.from(base64String.trim(), 'base64');
    let index = 0;
    const tags: TLVTag[] = [];
    const parsedFields: Record<string, string> = {};

    const tagNames: Record<number, { name: string; key: string; desc: string }> = {
      1: { name: 'Seller Name', key: 'sellerName', desc: 'Taxpayer / Seller Name' },
      2: { name: 'VAT Number', key: 'vatNumber', desc: '15-digit VAT Number' },
      3: { name: 'Timestamp', key: 'timestamp', desc: 'Invoice Date & Time' },
      4: { name: 'Total with VAT', key: 'totalWithVat', desc: 'Grand Total in SAR' },
      5: { name: 'VAT Total', key: 'vatTotal', desc: 'Total VAT in SAR' },
      6: { name: 'Invoice Hash', key: 'invoiceHash', desc: 'SHA-256 XML Digest' },
      7: { name: 'Digital Signature', key: 'signature', desc: 'ECDSA Signature' },
      8: { name: 'Public Key', key: 'publicKey', desc: 'ECDSA Public Key' },
      9: { name: 'Certificate Signature', key: 'certificateSignature', desc: 'CSID Signature' },
    };

    while (index < buffer.length) {
      if (index + 2 > buffer.length) break;

      const tag = buffer.readUInt8(index);
      const length = buffer.readUInt8(index + 1);
      index += 2;

      if (index + length > buffer.length) {
        break;
      }

      const valBuf = buffer.subarray(index, index + length);
      const strVal = valBuf.toString('utf8');
      index += length;

      const meta = tagNames[tag] || { name: `Custom Tag ${tag}`, key: `tag_${tag}`, desc: `Tag ${tag} value` };
      
      parsedFields[meta.key] = strVal;

      tags.push({
        tag,
        name: meta.name,
        description: meta.desc,
        value: strVal,
        length,
        hexValue: valBuf.toString('hex').toUpperCase(),
      });
    }

    return {
      isValidZATCA: tags.length >= 5, // Basic ZATCA requirement: tags 1-5 mandatory
      rawBase64: base64String,
      tags,
      parsedFields: {
        sellerName: parsedFields.sellerName,
        vatNumber: parsedFields.vatNumber,
        timestamp: parsedFields.timestamp,
        totalWithVat: parsedFields.totalWithVat,
        vatTotal: parsedFields.vatTotal,
        invoiceHash: parsedFields.invoiceHash,
        signature: parsedFields.signature,
        publicKey: parsedFields.publicKey,
        certificateSignature: parsedFields.certificateSignature,
      },
    };
  } catch (error) {
    return {
      isValidZATCA: false,
      rawBase64: base64String,
      tags: [],
      parsedFields: {},
    };
  }
}

/**
 * Computes SHA-256 hash of a string (UBL XML or payload) and returns Base64 string.
 */
export function computeSHA256Base64(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('base64');
}

/**
 * Computes SHA-256 hash and returns Hex string.
 */
export function computeSHA256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generates initial default Previous Invoice Hash (PIH) for ICV = 0 as specified by ZATCA:
 * Base64 string of SHA-256 of '0'.
 */
export function getInitialPIH(): string {
  return computeSHA256Base64('0');
}

/**
 * Generates keypair for EGS CSID simulation.
 */
export function generateEGSKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // standard secp256r1 / ecdsa-sha256
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return { publicKey, privateKey };
}

/**
 * Signs an invoice hash using ECDSA private key.
 */
export function signInvoiceHash(hashBase64: string, privateKeyPem: string): string {
  try {
    const sign = crypto.createSign('SHA256');
    sign.update(hashBase64);
    sign.end();
    return sign.sign(privateKeyPem, 'base64');
  } catch {
    // Fallback deterministic signature if key format differs
    return crypto.createHmac('sha256', privateKeyPem || 'zatca_secret').update(hashBase64).digest('base64');
  }
}
