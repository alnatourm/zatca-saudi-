import crypto from 'crypto';

export interface CSRRequestParams {
  commonName: string;
  vatNumber: string;
  organizationName: string;
  organizationUnitName: string;
  countryName: string;
  registeredAddress: string;
  businessCategory: string;
}

export function generateZatcaKeyPairAndCSR(params: CSRRequestParams) {
  // Generate ECDSA prime256v1 / secp256k1 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Simulated CSR Generation for ZATCA OIDs
  const csrPem = [
    '-----BEGIN CERTIFICATE REQUEST-----',
    Buffer.from(`ZATCA-CSR:${params.commonName}:${params.vatNumber}:${params.organizationName}`).toString('base64'),
    '-----END CERTIFICATE REQUEST-----',
  ].join('\n');

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    csrPem,
  };
}
