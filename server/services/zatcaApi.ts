import crypto from 'crypto';
import { generateZatcaKeyPairAndCSR, CSRRequestParams } from '../crypto/csr';

export interface CSIDResponse {
  requestID: number;
  dispositionMessage: string;
  binarySecurityToken: string;
  secret: string;
  complianceCSID: string;
  productionCSID: string;
  issuedAt: string;
}

/**
 * ZATCA Fatoora Sandbox / Simulation API Dispatcher for CSID Onboarding & Clearance/Reporting
 */
export async function onboardCSIDWithOTP(params: {
  otp: string;
  vatNumber: string;
  taxpayerName: string;
  city: string;
}): Promise<CSIDResponse> {
  // Generate real cryptographic key pair and CSR
  const csrData: CSRRequestParams = {
    commonName: params.taxpayerName,
    vatNumber: params.vatNumber,
    organizationName: params.taxpayerName,
    organizationUnitName: 'Main Branch',
    countryName: 'SA',
    registeredAddress: params.city,
    businessCategory: 'Retail',
  };

  const { csrPem } = generateZatcaKeyPairAndCSR(csrData);

  // Simulated ZATCA Portal CSID Issuance
  const requestID = Math.floor(100000 + Math.random() * 900000);
  const binarySecurityToken = Buffer.from(`ZATCA-X509-CERT-${params.vatNumber}-${requestID}`).toString('base64');
  const secret = crypto.randomBytes(16).toString('hex');
  const complianceCSID = `CSID-COMPLIANCE-${params.vatNumber}-${requestID}`;
  const productionCSID = `CSID-PRODUCTION-${params.vatNumber}-${requestID}`;

  return {
    requestID,
    dispositionMessage: 'ISSUED_SIMULATION',
    binarySecurityToken,
    secret,
    complianceCSID,
    productionCSID,
    issuedAt: new Date().toISOString(),
  };
}

export async function reportSimplifiedInvoice(signedXmlBase64: string, invoiceHash: string) {
  return {
    status: 'REPORTED',
    clearanceStatus: 'PASS',
    validationResults: {
      infoMessages: [{ code: 'INFO_001', message: 'Invoice reported to ZATCA Simulation Sandbox' }],
      warningMessages: [],
      errorMessages: [],
    },
    reportingTimestamp: new Date().toISOString(),
  };
}
