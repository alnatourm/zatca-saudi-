import fs from 'fs';
import path from 'path';
import { getInitialPIH } from './crypto';

export interface CompanyTenant {
  id: string;                      // slug / uuid, e.g. "single-test-company"
  name: string;                    // e.g. "Saudi Flame Grill"
  type: 'restaurant' | 'company';  // Restaurant (POS) vs General Commercial B2B
  vatNumber: string;               // 15-digit VAT
  crNumber: string;                // 10-digit CR
  branchName: string;
  city: string;
  district: string;
  streetName: string;
  buildingNumber: string;
  postalCode: string;
  egsUuid: string;
  environment: 'simulation' | 'production';
  csidStatus: 'NOT_ONBOARDED' | 'CCSID_ACTIVE' | 'COMPLIANCE_ACTIVE' | 'PRODUCTION_ACTIVE';
  complianceRequestId?: string;
  productionRequestId?: string;
  binarySecurityToken?: string;    // Base64 CSID Cert
  secret?: string;                 // API Secret
  privateKeyPem?: string;          // secp256k1 key
  publicKeyPem?: string;
  cleanCsrBase64?: string;
  icv: number;                     // Isolated monotonic counter
  pih: string;                     // Isolated previous invoice hash
  createdAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), 'server/storage');
const TENANTS_FILE = path.join(STORAGE_DIR, 'tenants.json');

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(TENANTS_FILE)) {
    const initialTenants: Record<string, CompanyTenant> = {};
    fs.writeFileSync(TENANTS_FILE, JSON.stringify(initialTenants, null, 2));
    try { fs.chmodSync(TENANTS_FILE, 0o600); } catch (_) {}
  }
}

export function getAllTenants(): CompanyTenant[] {
  ensureStorage();
  try {
    const data = JSON.parse(fs.readFileSync(TENANTS_FILE, 'utf8'));
    return Object.values(data);
  } catch (_e) {
    return [];
  }
}

export function getTenantById(tenantId: string): CompanyTenant | null {
  ensureStorage();
  try {
    const data = JSON.parse(fs.readFileSync(TENANTS_FILE, 'utf8'));
    return data[tenantId] || null;
  } catch (_e) {
    return null;
  }
}

export function saveTenant(tenant: CompanyTenant): void {
  ensureStorage();
  let data: Record<string, CompanyTenant> = {};
  try {
    data = JSON.parse(fs.readFileSync(TENANTS_FILE, 'utf8'));
  } catch (_e) {
    data = {};
  }
  data[tenant.id] = tenant;
  fs.writeFileSync(TENANTS_FILE, JSON.stringify(data, null, 2));
  try { fs.chmodSync(TENANTS_FILE, 0o600); } catch (_) {}
}

export function updateTenantChain(tenantId: string, newHash: string): { icv: number; pih: string } {
  const tenant = getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  tenant.icv += 1;
  tenant.pih = newHash;
  saveTenant(tenant);
  return { icv: tenant.icv, pih: tenant.pih };
}
