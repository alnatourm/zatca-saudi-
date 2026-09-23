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

export interface EgsCsrParams {
  environment?: 'sandbox' | 'simulation' | 'production';
  vatNumber: string;
  companyName: string;
  branchName: string;
  city: string;
  businessCategory: string;
  egsUuid: string;
}

export function generateZatcaKeyPairAndCSR(params: CSRRequestParams) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

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

export function generateEgsCsr(params: EgsCsrParams, _storageDir?: string) {
  const res = generateZatcaKeyPairAndCSR({
    commonName: params.companyName,
    vatNumber: params.vatNumber,
    organizationName: params.companyName,
    organizationUnitName: params.branchName,
    countryName: 'SA',
    registeredAddress: params.city,
    businessCategory: params.businessCategory,
  });

  const cleanCsrBase64 = Buffer.from(res.csrPem).toString('base64');

  return {
    ...res,
    cleanCsrBase64,
  };
}
