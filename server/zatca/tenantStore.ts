import fs from 'fs';
import path from 'path';
import { getInitialPIH } from './crypto';

export interface CompanyTenant {
  id: string;                      // slug / uuid, e.g. "saudi-flame-grill"
  name: string;                    // e.g. "مطعم المذاق السعودي (Saudi Flame Grill)"
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
  csidStatus: 'NOT_ONBOARDED' | 'COMPLIANCE_ACTIVE' | 'PRODUCTION_ACTIVE';
  complianceRequestId?: string;
  productionRequestId?: string;
  binarySecurityToken?: string;    // Base64 CSID Cert
  secret?: string;                 // API Secret
  privateKeyPem?: string;          // secp256k1 key
  publicKeyPem?: string;
  icv: number;                     // Isolated monotonic counter
  pih: string;                     // Isolated previous invoice hash
  createdAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), 'server/storage');
const TENANTS_FILE = path.join(STORAGE_DIR, 'tenants.json');

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(TENANTS_FILE)) {
    // Seed initial demo tenants: 1 Restaurant + 1 B2B Company
    const initialTenants: Record<string, CompanyTenant> = {
      'saudi-flame-grill': {
        id: 'saudi-flame-grill',
        name: 'مطعم المذاق السعودي (Saudi Flame Grill)',
        type: 'restaurant',
        vatNumber: '300049785700003',
        crNumber: '1010884422',
        branchName: 'فرع العليا - الرياض',
        city: 'الرياض',
        district: 'العليا',
        streetName: 'طريق الملك فهد',
        buildingNumber: '2145',
        postalCode: '12211',
        egsUuid: '8b9d5c41-8654-4770-9831-2911b333a101',
        environment: 'simulation',
        csidStatus: 'COMPLIANCE_ACTIVE',
        icv: 0,
        pih: getInitialPIH(),
        createdAt: new Date().toISOString(),
      },
      'al-noor-trading': {
        id: 'al-noor-trading',
        name: 'شركة النور للتجارة والحلول التقنية',
        type: 'company',
        vatNumber: '300012345600003',
        crNumber: '1010987654',
        branchName: 'المركز الرئيسي',
        city: 'جدة',
        district: 'الروضة',
        streetName: 'شارع الأمير سلطان',
        buildingNumber: '4210',
        postalCode: '23431',
        egsUuid: '1f3c7e99-2311-4552-a199-0011bb22cc33',
        environment: 'simulation',
        csidStatus: 'NOT_ONBOARDED',
        icv: 0,
        pih: getInitialPIH(),
        createdAt: new Date().toISOString(),
      },
    };
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
