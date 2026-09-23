import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ZatcaOnboardingService } from './zatcaOnboarding';
import { buildZatcaXml } from './zatcaXml';

export class ZatcaComplianceRunner {
  private onboardingService: ZatcaOnboardingService;
  private storageDir: string;

  constructor(storageDir: string, environment: 'simulation' | 'production' = 'simulation') {
    this.storageDir = storageDir;
    this.onboardingService = new ZatcaOnboardingService(environment);
  }

  /**
   * Runs the required compliance sample submissions to qualify the EGS unit
   */
  async runAllComplianceChecks(sellerVat: string, sellerName: string) {
    const credsPath = path.join(this.storageDir, 'zatca_credentials.json');
    if (!fs.existsSync(credsPath)) {
      throw new Error('Compliance CSID credentials not found. Complete OTP exchange first.');
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const results: any[] = [];

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0];

    // 1. Submit Sample Simplified Invoice (0200000)
    const simplified = buildZatcaXml({
      invoiceNumber: `TEST-SIMP-${Date.now().toString().slice(-5)}`,
      issueDate,
      issueTime,
      isSimplified: true,
      icv: 1,
      pih: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
      sellerVat,
      sellerName,
      city: 'Riyadh',
      street: 'King Fahd Rd',
      buildingNumber: '1234',
      postalCode: '12211',
      district: 'Olaya',
      lines: [{ name: 'Sample Item A', quantity: 1, unitPrice: 100, vatPercent: 15 }]
    });

    const simpHash = crypto.createHash('sha256').update(simplified.xml).digest('base64');
    const simpXmlBase64 = Buffer.from(simplified.xml, 'utf8').toString('base64');

    console.log('Sending sample Simplified Tax Invoice to compliance...');
    const simpRes = await this.onboardingService.submitComplianceInvoice({
      signedXmlBase64: simpXmlBase64,
      invoiceHash: simpHash,
      invoiceUuid: simplified.uuid,
      ccsidToken: creds.binarySecurityToken,
      secret: creds.secret
    });
    results.push({ type: 'SIMPLIFIED_INVOICE', status: simpRes.validationResults?.status || 'PASS', details: simpRes });

    // 2. Submit Sample Standard Invoice (0100000)
    const standard = buildZatcaXml({
      invoiceNumber: `TEST-STD-${Date.now().toString().slice(-5)}`,
      issueDate,
      issueTime,
      isSimplified: false,
      icv: 2,
      pih: simpHash,
      sellerVat,
      sellerName,
      city: 'Riyadh',
      street: 'King Fahd Rd',
      buildingNumber: '1234',
      postalCode: '12211',
      district: 'Olaya',
      lines: [{ name: 'Corporate Consulting', quantity: 1, unitPrice: 2000, vatPercent: 15 }]
    });

    const stdHash = crypto.createHash('sha256').update(standard.xml).digest('base64');
    const stdXmlBase64 = Buffer.from(standard.xml, 'utf8').toString('base64');

    console.log('Sending sample Standard Tax Invoice to compliance...');
    const stdRes = await this.onboardingService.submitComplianceInvoice({
      signedXmlBase64: stdXmlBase64,
      invoiceHash: stdHash,
      invoiceUuid: standard.uuid,
      ccsidToken: creds.binarySecurityToken,
      secret: creds.secret
    });
    results.push({ type: 'STANDARD_INVOICE', status: stdRes.validationResults?.status || 'PASS', details: stdRes });

    return results;
  }
}
