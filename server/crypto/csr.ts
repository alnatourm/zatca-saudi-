import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface CSRRequestParams {
  commonName?: string;
  vatNumber: string;
  organizationName: string;
  organizationUnitName: string;
  countryName?: string;
  registeredAddress: string;
  businessCategory: string;
}

export function generateZatcaKeyPairAndCSR(params: CSRRequestParams) {
  return generateEgsCsr({
    vatNumber: params.vatNumber,
    companyName: params.organizationName,
    branchName: params.organizationUnitName,
    city: params.registeredAddress,
    businessCategory: params.businessCategory,
    egsUuid: crypto.randomUUID(),
  });
}

export interface EgsCsrParams {
  environment?: 'sandbox' | 'simulation' | 'production';
  vatNumber: string;         // 15-digit number starting and ending with 3
  companyName: string;       // Taxpayer / Organization Name
  branchName: string;        // Branch Name / Organizational Unit
  city: string;              // Registered Address City
  businessCategory: string;  // e.g. "Food and Beverage" or "Retail"
  egsUuid: string;           // Machine UUID
}

export function generateEgsCsr(params: EgsCsrParams, storageDir: string = path.join(process.cwd(), 'server/storage')) {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const keyPath = path.join(storageDir, 'egs_private_key.pem');
  const configPath = path.join(storageDir, 'egs_csr.cnf');
  const csrPath = path.join(storageDir, 'egs_request.csr');
  const pubKeyPath = path.join(storageDir, 'egs_public_key.pem');

  const certTemplate = params.environment === 'production'
    ? 'ZATCA-Code-Signing'
    : 'PREZATCA-Code-Signing';

  const serialNumber = `1-POS|2-STANDALONE|3-${params.egsUuid}`;
  const commonName = `TST-${params.vatNumber}-${params.egsUuid.slice(0, 8)}`;

  // Construct official OpenSSL configuration mapping ZATCA custom SAN OIDs
  const opensslConfig = `
oid_section = OIDs

[OIDs]
certificateTemplateName = 1.3.6.1.4.1.311.20.2

[req]
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
C = SA
OU = ${params.branchName}
O = ${params.companyName}
CN = ${commonName}

[req_ext]
certificateTemplateName = ASN1:PRINTABLESTRING:${certTemplate}
subjectAltName = dirName:alt_names

[alt_names]
SN = ${serialNumber}
UID = ${params.vatNumber}
title = 1100
registeredAddress = ${params.city}
businessCategory = ${params.businessCategory}
`.trim();

  fs.writeFileSync(configPath, opensslConfig);

  try {
    // 1. Generate real ECDSA key using curve secp256k1 (Required by ZATCA)
    if (!fs.existsSync(keyPath)) {
      execSync(`openssl ecparam -name secp256k1 -genkey -noout -out "${keyPath}"`);
    }

    // 2. Generate valid PKCS#10 CSR with ASN.1 Subject Alternative Names
    execSync(`openssl req -new -sha256 -key "${keyPath}" -config "${configPath}" -out "${csrPath}"`);

    // 3. Extract Public Key
    execSync(`openssl ec -in "${keyPath}" -pubout -out "${pubKeyPath}" 2>/dev/null`);

    const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
    const publicKeyPem = fs.readFileSync(pubKeyPath, 'utf8');
    const csrPem = fs.readFileSync(csrPath, 'utf8');

    // Strip PEM armor for raw Base64 payload required by POST /compliance
    const cleanCsrBase64 = csrPem
      .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
      .replace(/-----END CERTIFICATE REQUEST-----/g, '')
      .replace(/[\r\n\s]/g, '');

    return {
      privateKeyPem,
      publicKeyPem,
      csrPem,
      cleanCsrBase64,
    };
  } catch (err: any) {
    throw new Error(`Failed to generate ZATCA PKCS#10 CSR via OpenSSL: ${err.message || err}`);
  }
}
