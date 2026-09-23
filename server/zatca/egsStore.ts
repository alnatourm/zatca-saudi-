import { EGSState, TaxpayerDetails, CSIDCertificate, GeneratedInvoiceResponse } from './types';
import { generateEGSKeys, getInitialPIH } from './crypto';

// Default initial onboarded state or blank state
let state: EGSState = {
  isOnboarded: true,
  egsUuid: 'EGS-SA-982144-88',
  taxpayer: {
    taxpayerName: 'Al-Noor Retail & Trade LLC',
    vatNumber: '300012345600003',
    branchName: 'Riyadh Main Branch',
    city: 'Riyadh',
    otp: '123456',
    crNumber: '1010987654',
    streetName: 'King Fahd Road',
    buildingNumber: '4210',
    postalCode: '12211',
    district: 'Olaya District',
  },
  certificate: {
    serialNumber: 'ZATCA-CSID-2026-990142',
    issueDate: '2026-01-15',
    expiryDate: '2027-01-15',
    environment: 'Simulation',
    binarySecurityToken: 'MIIBiTCCASoCCQCW38...ZATCA_SIMULATION_TOKEN',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH...\n-----END PRIVATE KEY-----',
    complianceCSID: 'CSID-COMPLIANCE-88219412',
    productionCSID: 'CSID-PRODUCTION-99210041',
    status: 'ACTIVE',
  },
  icv: 0,
  pih: getInitialPIH(),
  lastUpdated: new Date().toISOString(),
};

const invoiceStore: GeneratedInvoiceResponse[] = [];

export function getEGSState(): EGSState {
  return { ...state };
}

export function onboardEGS(taxpayerInput: TaxpayerDetails): EGSState {
  const { publicKey, privateKey } = generateEGSKeys();
  const serialNum = `CSID-KSA-${Math.floor(100000 + Math.random() * 900000)}`;

  const cert: CSIDCertificate = {
    serialNumber: serialNum,
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    environment: 'Simulation',
    binarySecurityToken: Buffer.from(`ZATCA_TOKEN_${serialNum}_${taxpayerInput.vatNumber}`).toString('base64'),
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    complianceCSID: `CSID-COMP-${Math.floor(100000 + Math.random() * 900000)}`,
    productionCSID: `CSID-PROD-${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'ACTIVE',
  };

  state = {
    isOnboarded: true,
    egsUuid: `EGS-UUID-${Math.floor(100000 + Math.random() * 900000)}`,
    taxpayer: {
      ...taxpayerInput,
      crNumber: taxpayerInput.crNumber || '1010123456',
      streetName: taxpayerInput.streetName || 'Olaya Main Street',
      buildingNumber: taxpayerInput.buildingNumber || '1010',
      postalCode: taxpayerInput.postalCode || '12211',
      district: taxpayerInput.district || 'Al Olaya',
    },
    certificate: cert,
    icv: 0,
    pih: getInitialPIH(),
    lastUpdated: new Date().toISOString(),
  };

  return getEGSState();
}

export function updateStateAfterInvoice(newHashBase64: string): { icv: number; pih: string } {
  state.icv += 1;
  state.pih = newHashBase64;
  state.lastUpdated = new Date().toISOString();
  return { icv: state.icv, pih: state.pih };
}

export function saveInvoice(invoice: GeneratedInvoiceResponse) {
  invoiceStore.unshift(invoice); // recent first
}

export function getInvoiceList(): GeneratedInvoiceResponse[] {
  return [...invoiceStore];
}

export function getInvoiceById(id: string): GeneratedInvoiceResponse | undefined {
  return invoiceStore.find((inv) => inv.id === id || inv.uuid === id);
}

export function resetEGSState(): EGSState {
  state.icv = 0;
  state.pih = getInitialPIH();
  state.lastUpdated = new Date().toISOString();
  invoiceStore.length = 0; // Clear invoice history
  return getEGSState();
}
