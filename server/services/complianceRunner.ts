import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ZatcaOnboardingService } from './zatcaOnboarding';
import { buildZatcaXml } from './zatcaXml';
import { computeZatcaInvoiceHash, signInvoiceHash } from '../zatca/crypto';
import { buildCompleteXadesSignature } from '../zatca/xades';

export class ZatcaComplianceRunner {
  private onboardingService: ZatcaOnboardingService;
  private storageDir: string;

  constructor(storageDir: string, environment: 'simulation' | 'production' = 'simulation') {
    this.storageDir = storageDir;
    this.onboardingService = new ZatcaOnboardingService(environment);
  }

  /**
   * Runs the required 4-document compliance test battery to qualify the EGS unit:
   * 1. Simplified Tax Invoice (0200000, 388)
   * 2. Simplified Credit Note (0200000, 381)
   * 3. Standard Tax Invoice (0100000, 388)
   * 4. Standard Debit Note (0100000, 383)
   */
  async runAllComplianceChecks(sellerVat: string, sellerName: string) {
    const credsPath = path.join(this.storageDir, 'zatca_credentials.json');
    if (!fs.existsSync(credsPath)) {
      throw new Error('Compliance CSID credentials not found. Complete OTP exchange first.');
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const keyPath = path.join(this.storageDir, 'egs_private_key.pem');
    const privateKeyPem = creds.privateKeyPem || (fs.existsSync(keyPath) ? fs.readFileSync(keyPath, 'utf8') : '');

    const results: any[] = [];

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0];

    let currentPih = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

    const testRuns = [
      {
        testName: 'Simplified Tax Invoice',
        code: '388',
        subType: '0200000',
        isSimplified: true,
        invNum: `TEST-SIMP-${Date.now().toString().slice(-5)}`,
        isNote: false,
      },
      {
        testName: 'Simplified Credit Note',
        code: '381',
        subType: '0200000',
        isSimplified: true,
        invNum: `TEST-CN-${Date.now().toString().slice(-5)}`,
        isNote: true,
        refNumber: `TEST-SIMP-${Date.now().toString().slice(-5)}`,
      },
      {
        testName: 'Standard Tax Invoice',
        code: '388',
        subType: '0100000',
        isSimplified: false,
        invNum: `TEST-STD-${Date.now().toString().slice(-5)}`,
        isNote: false,
      },
      {
        testName: 'Standard Debit Note',
        code: '383',
        subType: '0100000',
        isSimplified: false,
        invNum: `TEST-DN-${Date.now().toString().slice(-5)}`,
        isNote: true,
        refNumber: `TEST-STD-${Date.now().toString().slice(-5)}`,
      },
    ];

    let icv = 1;
    for (const test of testRuns) {
      console.log(`Generating & submitting ${test.testName}...`);

      const doc = buildZatcaXml({
        invoiceNumber: test.invNum,
        issueDate,
        issueTime,
        isSimplified: test.isSimplified,
        invoiceTypeCode: test.code,
        billingReferenceId: test.refNumber,
        icv,
        pih: currentPih,
        sellerVat,
        sellerName,
        city: 'Riyadh',
        street: 'King Fahd Rd',
        buildingNumber: '1234',
        postalCode: '12211',
        district: 'Olaya',
        lines: [{ name: `Sample Item - ${test.testName}`, quantity: 1, unitPrice: 200, vatPercent: 15 }]
      });

      const docHash = computeZatcaInvoiceHash(doc.xml);
      let finalXml = doc.xml;

      if (privateKeyPem) {
        const issueDateTime = `${issueDate}T${issueTime}Z`;
        const xadesBlock = buildCompleteXadesSignature({
          invoiceHashBase64: docHash,
          privateKeyPem,
          csidCertificateBase64: creds.binarySecurityToken,
          issueDateTime,
        });

        // Inject UBLExtensions right after opening <Invoice ...> tag
        finalXml = doc.xml.replace(/(<Invoice[^>]*>)/, `$1${xadesBlock}`);
      }

      const signedXmlBase64 = Buffer.from(finalXml, 'utf8').toString('base64');

      try {
        const res = await this.onboardingService.submitComplianceInvoice({
          signedXmlBase64,
          invoiceHash: docHash,
          invoiceUuid: doc.uuid,
          ccsidToken: creds.binarySecurityToken,
          secret: creds.secret,
        });

        results.push({
          test: test.testName,
          status: res.validationResults?.status || 'PASS',
          details: res,
        });
      } catch (err: any) {
        results.push({
          test: test.testName,
          status: 'ERROR',
          error: err.message,
        });
      }

      currentPih = docHash;
      icv++;
    }

    return results;
  }
}
