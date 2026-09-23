import { EGSState, TaxpayerDetails, CSIDCertificate, GeneratedInvoiceResponse } from './types';
import { generateEGSKeys, getInitialPIH } from './crypto';
import { getAllTenants, getTenantById, saveTenant, updateTenantChain, CompanyTenant } from './tenantStore';

let activeTenantId: string = 'saudi-flame-grill';

export function getActiveTenantId(): string {
  return activeTenantId;
}

export function setActiveTenantId(tenantId: string): CompanyTenant {
  const tenant = getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  activeTenantId = tenantId;
  return tenant;
}

export function getEGSState(tenantId?: string): EGSState {
  const targetId = tenantId || activeTenantId;
  const tenant = getTenantById(targetId) || getAllTenants()[0];

  if (!tenant) {
    return {
      isOnboarded: false,
      egsUuid: 'EGS-UUID-DEFAULT',
      taxpayer: {
        taxpayerName: 'Default Taxpayer',
        vatNumber: '300049785700003',
        branchName: 'Main Branch',
        city: 'Riyadh',
      },
      certificate: null,
      icv: 0,
      pih: getInitialPIH(),
      lastUpdated: new Date().toISOString(),
    };
  }

  const { publicKey, privateKey } = tenant.privateKeyPem && tenant.publicKeyPem
    ? { publicKey: tenant.publicKeyPem, privateKey: tenant.privateKeyPem }
    : generateEGSKeys();

  const cert: CSIDCertificate = {
    serialNumber: `CSID-${tenant.id}`,
    issueDate: tenant.createdAt.split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    environment: tenant.environment === 'production' ? 'Production' : 'Simulation',
    binarySecurityToken: tenant.binarySecurityToken || Buffer.from(`TOKEN_${tenant.id}`).toString('base64'),
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    complianceCSID: tenant.complianceRequestId || `CSID-COMP-${tenant.id}`,
    productionCSID: tenant.productionRequestId || `CSID-PROD-${tenant.id}`,
    status: tenant.csidStatus === 'NOT_ONBOARDED' ? 'REVOKED' : 'ACTIVE',
  };

  return {
    isOnboarded: tenant.csidStatus !== 'NOT_ONBOARDED',
    egsUuid: tenant.egsUuid,
    taxpayer: {
      taxpayerName: tenant.name,
      vatNumber: tenant.vatNumber,
      branchName: tenant.branchName,
      city: tenant.city,
      crNumber: tenant.crNumber,
      streetName: tenant.streetName,
      buildingNumber: tenant.buildingNumber,
      postalCode: tenant.postalCode,
      district: tenant.district,
    },
    certificate: cert,
    icv: tenant.icv,
    pih: tenant.pih || getInitialPIH(),
    lastUpdated: tenant.createdAt,
  };
}

const invoiceStore: Record<string, GeneratedInvoiceResponse[]> = {};

// Atomic sequence lock to prevent ICV sequence gaps or race conditions
let lockPromise: Promise<void> = Promise.resolve();

export async function acquireSequenceLock<T>(fn: () => T | Promise<T>): Promise<T> {
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  const previousLock = lockPromise;
  lockPromise = (async () => {
    await previousLock;
    await nextLock;
  })();

  await previousLock;
  try {
    return await fn();
  } finally {
    release!();
  }
}

export function onboardEGS(taxpayerInput: TaxpayerDetails, tenantId?: string): EGSState {
  const targetId = tenantId || activeTenantId;
  const tenant = getTenantById(targetId);
  const { publicKey, privateKey } = generateEGSKeys();

  if (tenant) {
    tenant.name = taxpayerInput.taxpayerName || tenant.name;
    tenant.vatNumber = taxpayerInput.vatNumber || tenant.vatNumber;
    tenant.branchName = taxpayerInput.branchName || tenant.branchName;
    tenant.city = taxpayerInput.city || tenant.city;
    tenant.crNumber = taxpayerInput.crNumber || tenant.crNumber;
    tenant.streetName = taxpayerInput.streetName || tenant.streetName;
    tenant.buildingNumber = taxpayerInput.buildingNumber || tenant.buildingNumber;
    tenant.postalCode = taxpayerInput.postalCode || tenant.postalCode;
    tenant.district = taxpayerInput.district || tenant.district;
    tenant.publicKeyPem = publicKey;
    tenant.privateKeyPem = privateKey;
    tenant.binarySecurityToken = Buffer.from(`ZATCA_TOKEN_${tenant.id}_${tenant.vatNumber}`).toString('base64');
    tenant.csidStatus = 'COMPLIANCE_ACTIVE';
    saveTenant(tenant);
  }

  return getEGSState(targetId);
}

export function updateStateAfterInvoice(newHashBase64: string, tenantId?: string): { icv: number; pih: string } {
  const targetId = tenantId || activeTenantId;
  return updateTenantChain(targetId, newHashBase64);
}

export function saveInvoice(invoice: GeneratedInvoiceResponse, tenantId?: string) {
  const targetId = tenantId || activeTenantId;
  if (!invoiceStore[targetId]) invoiceStore[targetId] = [];
  invoiceStore[targetId].unshift(invoice); // recent first
}

export function getInvoiceList(tenantId?: string): GeneratedInvoiceResponse[] {
  const targetId = tenantId || activeTenantId;
  return [...(invoiceStore[targetId] || [])];
}

export function getInvoiceById(id: string, tenantId?: string): GeneratedInvoiceResponse | undefined {
  const targetId = tenantId || activeTenantId;
  return (invoiceStore[targetId] || []).find((inv) => inv.id === id || inv.uuid === id);
}

export function resetEGSState(tenantId?: string): EGSState {
  const targetId = tenantId || activeTenantId;
  const tenant = getTenantById(targetId);
  if (tenant) {
    tenant.icv = 0;
    tenant.pih = getInitialPIH();
    saveTenant(tenant);
  }
  invoiceStore[targetId] = [];
  return getEGSState(targetId);
}
