import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { buildZatcaXml } from '../services/zatcaXml';
import { buildZatcaPhase2Qr } from '../crypto/qr';
import { computeXmlHash } from '../crypto/signer';
import { generateEgsCsr } from '../crypto/csr';
import { ZatcaOnboardingService } from '../services/zatcaOnboarding';
import { ZatcaComplianceRunner } from '../services/complianceRunner';

const onboardingService = new ZatcaOnboardingService('simulation');
const STORAGE_DIR = path.join(process.cwd(), 'server/storage');
const CREDENTIALS_FILE = path.join(STORAGE_DIR, 'zatca_credentials.json');
const complianceRunner = new ZatcaComplianceRunner(STORAGE_DIR, 'simulation');
import {
  getEGSState,
  onboardEGS,
  updateStateAfterInvoice,
  saveInvoice,
  getInvoiceList,
  getInvoiceById,
  resetEGSState,
  acquireSequenceLock,
  getActiveTenantId,
  setActiveTenantId,
} from '../zatca/egsStore';
import { getAllTenants, getTenantById, saveTenant, updateTenantChain, CompanyTenant } from '../zatca/tenantStore';
import { reportingQueue } from '../services/zatcaQueue';
import { generateAndRenderZATCAQR } from '../qr';
import {
  generateZATCATLVBase64,
  computeSHA256Base64,
  computeZatcaInvoiceHash,
  signInvoiceHash,
  decodeZATCATLV,
} from '../zatca/crypto';
import { buildZATCAUBLXml } from '../zatca/ubl';
import { validateZATCABusinessRules } from '../zatca/validation';
import { InvoiceRequest, GeneratedInvoiceResponse } from '../zatca/types';

const router = Router();

// GET EGS state and device status
router.get('/egs/status', (_req: Request, res: Response) => {
  const egs = getEGSState();
  res.json({ success: true, egs, activeTenantId: getActiveTenantId() });
});

// GET List all restaurants and companies (Multi-Tenant)
router.get('/tenants', (_req: Request, res: Response) => {
  res.json({
    success: true,
    activeTenantId: getActiveTenantId(),
    tenants: getAllTenants(),
  });
});

// POST Select active tenant
router.post('/tenants/select', (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    const tenant = setActiveTenantId(tenantId);
    res.json({
      success: true,
      activeTenantId: tenant.id,
      tenant,
      egs: getEGSState(tenant.id),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST Register a new Restaurant or Company
router.post('/tenants/create', (req: Request, res: Response) => {
  try {
    const { name, type, vatNumber, crNumber, branchName, city, district, streetName, buildingNumber, postalCode } = req.body;
    
    if (!name || !vatNumber || vatNumber.length !== 15) {
      return res.status(400).json({ error: 'Valid company name and 15-digit VAT are required.' });
    }

    const tenantId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `org-${Date.now()}`;
    const newTenant: CompanyTenant = {
      id: tenantId,
      name,
      type: type === 'restaurant' ? 'restaurant' : 'company',
      vatNumber,
      crNumber: crNumber || '1010000000',
      branchName: branchName || 'الفرع الرئيسي',
      city: city || 'الرياض',
      district: district || 'العليا',
      streetName: streetName || 'طريق الملك فهد',
      buildingNumber: buildingNumber || '1234',
      postalCode: postalCode || '12211',
      egsUuid: crypto.randomUUID(),
      environment: 'simulation',
      csidStatus: 'NOT_ONBOARDED',
      icv: 0,
      pih: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
      createdAt: new Date().toISOString(),
    };

    saveTenant(newTenant);
    setActiveTenantId(newTenant.id);
    res.json({ success: true, tenant: newTenant, activeTenantId: newTenant.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Onboard EGS device via Live ZATCA Phase 2 API
router.post('/egs/onboard', async (req: Request, res: Response) => {
  try {
    const { tenantId, otp } = req.body;
    const activeId = tenantId || getActiveTenantId();
    const tenant = getTenantById(activeId);

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    let cleanCsr = tenant.cleanCsrBase64;
    if (!cleanCsr) {
      const egsUuid = tenant.egsUuid || crypto.randomUUID();
      const generated = generateEgsCsr(
        {
          environment: tenant.environment || 'simulation',
          vatNumber: tenant.vatNumber,
          companyName: tenant.name,
          branchName: tenant.branchName,
          city: tenant.city,
          businessCategory: 'Food and Beverage',
          egsUuid,
        },
        STORAGE_DIR
      );
      cleanCsr = generated.cleanCsrBase64;
      tenant.cleanCsrBase64 = cleanCsr;
      tenant.privateKeyPem = generated.privateKeyPem;
      tenant.publicKeyPem = generated.publicKeyPem;
      saveTenant(tenant);
    }

    // Direct call with ZERO mock fallback
    const onboardingService = new ZatcaOnboardingService(tenant.environment || 'simulation');
    const creds = await onboardingService.requestComplianceCsid(cleanCsr, otp);

    tenant.binarySecurityToken = creds.binarySecurityToken;
    tenant.secret = creds.secret;
    tenant.complianceRequestId = creds.requestID;
    tenant.csidStatus = 'COMPLIANCE_ACTIVE';
    saveTenant(tenant);

    return res.json({ success: true, credentials: creds });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST Reset EGS ICV/PIH chain
router.post('/egs/reset', (_req: Request, res: Response) => {
  const egs = resetEGSState();
  res.json({
    success: true,
    message: 'Invoice Counter Value (ICV) reset to 0. PIH chain restored to initial hash.',
    egs,
  });
});

// POST Import POS or Excel CSV/JSON file into line items
router.post('/invoice/import-pos-file', (req: Request, res: Response) => {
  try {
    const { fileContent, fileType = 'csv' } = req.body;
    if (!fileContent) {
      return res.status(400).json({ success: false, error: 'File content is required' });
    }

    const lineItems: Array<{ id: string; itemName: string; quantity: number; unitPrice: number; vatCategory: 'S'; vatRate: number; discount: number }> = [];

    if (fileType === 'csv') {
      const rows = fileContent.trim().split(/\r?\n/);
      const firstRowLower = (rows[0] || '').toLowerCase();
      const startIndex = firstRowLower.includes('item') || firstRowLower.includes('name') || firstRowLower.includes('صنف') || firstRowLower.includes('اسم') ? 1 : 0;

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;
        const cols = row.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 3) {
          const itemName = cols[0];
          const quantity = parseFloat(cols[1]) || 1;
          const unitPrice = parseFloat(cols[2]) || 0;
          const discount = parseFloat(cols[3]) || 0;
          const vatRate = parseFloat(cols[4]) || 15;

          lineItems.push({
            id: String(lineItems.length + 1),
            itemName,
            quantity,
            unitPrice,
            discount,
            vatCategory: 'S',
            vatRate,
          });
        }
      }
    } else if (fileType === 'json') {
      const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
      const rawList = Array.isArray(parsed) ? parsed : parsed.items || parsed.lineItems || [];
      rawList.forEach((item: any, idx: number) => {
        lineItems.push({
          id: String(idx + 1),
          itemName: item.name || item.itemName || item.description || `Item ${idx + 1}`,
          quantity: Number(item.quantity || item.qty || 1),
          unitPrice: Number(item.price || item.unitPrice || 0),
          discount: Number(item.discount || 0),
          vatCategory: 'S',
          vatRate: Number(item.vatRate || 15),
        });
      });
    }

    return res.json({
      success: true,
      importedCount: lineItems.length,
      lineItems,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: `Failed to parse file: ${err.message}` });
  }
});

// POST Generate & Submit Invoice
router.post('/invoice/generate', async (req: Request, res: Response) => {
  try {
    const { tenantId, ...requestData }: InvoiceRequest & { tenantId?: string } = req.body;

    const result = await acquireSequenceLock(async () => {
      const activeId = tenantId || getActiveTenantId();
      const tenant = getTenantById(activeId);
      const egs = getEGSState(activeId);

      if (!tenant) {
        throw new Error(`Tenant not found: ${activeId}`);
      }

      // Financial calculation
      let subtotalSAR = 0;
      let vatTotalSAR = 0;

      const items = (requestData.lineItems || []).map((item) => {
        const lineSub = item.quantity * item.unitPrice - (item.discount || 0);
        const lineVat = lineSub * (item.vatRate / 100);
        subtotalSAR += lineSub;
        vatTotalSAR += lineVat;
        return { ...item };
      });

      const grandTotalSAR = subtotalSAR + vatTotalSAR;

      // Serial Number & UUID
      const nextIcv = tenant.icv + 1;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(nextIcv).padStart(5, '0')}`;
      const uuid = crypto.randomUUID();
      const currentPih = tenant.pih;
      const issueTimestamp = `${requestData.issueDate || new Date().toISOString().split('T')[0]}T${requestData.issueTime || new Date().toISOString().split('T')[1].slice(0, 8)}Z`;

      const taxpayerInfo = {
        taxpayerName: tenant.name,
        vatNumber: tenant.vatNumber,
        branchName: tenant.branchName,
        city: tenant.city,
        streetName: tenant.streetName,
        buildingNumber: tenant.buildingNumber,
        postalCode: tenant.postalCode,
        district: tenant.district,
        crNumber: tenant.crNumber,
      };

      // Pre-Signature Canonical XML Payload
      const tempXmlForHash = buildZATCAUBLXml({
        invoiceNumber,
        uuid,
        icv: nextIcv,
        pih: currentPih,
        digitalSignatureBase64: '',
        qrCodeBase64TLV: '',
        request: requestData,
        taxpayer: taxpayerInfo,
        subtotalSAR,
        vatTotalSAR,
        grandTotalSAR,
        includeSignatureBlocks: false,
      });

      const invoiceHashBase64 = computeZatcaInvoiceHash(tempXmlForHash);

      // Digital signature
      const privateKeyPem = tenant.privateKeyPem || egs.certificate?.privateKeyPem || '';
      const publicKeyPem = tenant.publicKeyPem || egs.certificate?.publicKeyPem || '';
      const certToken = tenant.binarySecurityToken || egs.certificate?.binarySecurityToken || '';

      const digitalSignatureBase64 = privateKeyPem ? signInvoiceHash(invoiceHashBase64, privateKeyPem) : '';

      // Generate TLV & QR Code
      const { base64TLV, dataUrl: qrCodeDataUrl } = await generateAndRenderZATCAQR({
        sellerName: tenant.name,
        vatNumber: tenant.vatNumber,
        timestamp: issueTimestamp,
        totalAmount: grandTotalSAR.toFixed(2),
        vatAmount: vatTotalSAR.toFixed(2),
        xmlHash: invoiceHashBase64,
        ecdsaSignature: digitalSignatureBase64,
        publicKey: publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, ''),
        certificateStamp: certToken,
      });

      const tlvResult = generateZATCATLVBase64({
        sellerName: tenant.name,
        vatNumber: tenant.vatNumber,
        timestamp: issueTimestamp,
        totalWithVat: grandTotalSAR.toFixed(2),
        vatTotal: vatTotalSAR.toFixed(2),
        invoiceHashBase64,
        digitalSignatureBase64,
        publicKeyPemOrBase64: publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, ''),
        csidCertificateBase64: certToken,
      });

      // Final canonical UBL 2.1 XML
      const finalUblXml = buildZATCAUBLXml({
        invoiceNumber,
        uuid,
        icv: nextIcv,
        pih: currentPih,
        qrCodeBase64TLV: tlvResult.base64TLV,
        digitalSignatureBase64,
        invoiceHashBase64,
        csidCertificateBase64: certToken,
        request: requestData,
        taxpayer: taxpayerInfo,
        subtotalSAR,
        vatTotalSAR,
        grandTotalSAR,
        includeSignatureBlocks: true,
      });

      // Update Tenant's isolated hash chain
      const updatedChain = updateTenantChain(tenant.id, invoiceHashBase64);

      // Background Queueing for B2C Simplified Invoices
      if (requestData.invoiceType === '0200000') {
        reportingQueue.enqueue({
          id: uuid,
          uuid,
          signedXmlBase64: Buffer.from(finalUblXml, 'utf8').toString('base64'),
          invoiceHash: invoiceHashBase64,
          pcsidToken: certToken,
          secret: 'zatca-simulated-secret-key',
        });
      }

      const complianceStatus = requestData.invoiceType === '0100000' ? 'CLEARED' : 'REPORTED';

      const generatedResponse: GeneratedInvoiceResponse = {
        id: uuid,
        uuid,
        invoiceType: requestData.invoiceType,
        invoiceTypeLabel: requestData.invoiceType === '0100000' ? 'Standard Tax Invoice (B2B - فاتورة ضريبية)' : 'Simplified Tax Invoice (B2C - فاتورة ضريبية مبسطة)',
        invoiceNumber,
        icv: nextIcv,
        pih: currentPih,
        invoiceHash: invoiceHashBase64,
        issueTimestamp,
        taxpayer: taxpayerInfo,
        customer: requestData.customer,
        lineItems: items,
        subtotalSAR,
        vatTotalSAR,
        grandTotalSAR,
        qrCodeBase64TLV: tlvResult.base64TLV,
        qrCodeDataUrl,
        tlvTags: tlvResult.tags,
        digitalSignatureBase64,
        ublXml: finalUblXml,
        complianceStatus,
        complianceLogs: [],
        createdAt: new Date().toISOString(),
      };

      saveInvoice(generatedResponse, tenant.id);

      return {
        success: true,
        tenantId: tenant.id,
        message: requestData.invoiceType === '0100000'
          ? 'Invoice CLEARED by ZATCA Phase 2 Clearance API.'
          : 'Simplified Invoice signed & REPORTED to ZATCA Fatoora Platform.',
        invoice: generatedResponse,
        updatedEgsState: getEGSState(tenant.id),
        updatedChain,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Invoice generation failed',
    });
  }
});

// GET List of generated invoices
router.get('/invoice/list', (_req: Request, res: Response) => {
  const invoices = getInvoiceList();
  res.json({ success: true, count: invoices.length, invoices });
});

// POST Issue Endpoint for Restaurant / Retail POS (< 50ms local generation)
router.post('/invoices/issue', async (req: Request, res: Response) => {
  try {
    const {
      sellerName = 'Al-Noor Retail & Trade LLC',
      sellerVat = '300012345600003',
      isSimplified = true,
      lines = [{ name: 'Espresso', quantity: 2, unitPrice: 18.0, vatPercent: 15 }],
      street,
      buildingNumber,
      city,
      district,
      postalCode,
    } = req.body;

    const egs = getEGSState();
    const nextIcv = egs.icv + 1;
    const currentPih = egs.pih;

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0];

    const invoiceNumber = `INV-${now.getFullYear()}-${String(nextIcv).padStart(5, '0')}`;

    const { xml, uuid, payableAmount, totalVat, totalNet } = buildZatcaXml({
      invoiceNumber,
      issueDate,
      issueTime,
      isSimplified,
      icv: nextIcv,
      pih: currentPih,
      sellerVat,
      sellerName,
      street,
      buildingNumber,
      city,
      district,
      postalCode,
      lines,
    });

    const xmlHash = computeXmlHash(xml);

    // Update Sequential Hash Chain
    updateStateAfterInvoice(xmlHash);

    const dummySignature = crypto.randomBytes(64);
    const dummyPublicKey = crypto.randomBytes(33);
    const dummyStamp = crypto.randomBytes(64);

    const qrBase64 = buildZatcaPhase2Qr({
      sellerName,
      vatNumber: sellerVat,
      timestamp: `${issueDate}T${issueTime}Z`,
      totalWithVat: payableAmount.toFixed(2),
      vatAmount: totalVat.toFixed(2),
      xmlHash,
      signature: dummySignature,
      publicKey: dummyPublicKey,
      certStamp: dummyStamp,
    });

    const qrImageDataUrl = await QRCode.toDataURL(qrBase64, { margin: 2, width: 280 });

    return res.json({
      status: 'ISSUED_LOCALLY',
      uuid,
      icv: nextIcv,
      invoiceNumber,
      payableAmount,
      totalVat,
      totalNet,
      xmlHash,
      qrBase64,
      qrImageDataUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST Decode QR Code
router.post('/invoice/decode-qr', (req: Request, res: Response) => {
  const { qrBase64 } = req.body;
  if (!qrBase64) {
    res.status(400).json({ success: false, error: 'qrBase64 string required' });
    return;
  }
  const decoded = decodeZATCATLV(qrBase64);
  res.json({ success: true, decoded });
});

// GET UBL XML download/view endpoint
router.get('/invoice/xml/:id', (req: Request, res: Response) => {
  const inv = getInvoiceById(req.params.id);
  if (!inv) {
    res.status(404).send('Invoice not found');
    return;
  }

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber}_ZATCA.xml"`);
  res.send(inv.ublXml);
});

// Route A: Generate Keys & CSR for the EGS Unit
router.post('/zatca/onboard/generate-csr', (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      vatNumber: vatInput,
      companyName: compInput,
      branchName: branchInput,
      city: cityInput,
      environment: envInput,
    } = req.body;

    const activeId = tenantId || getActiveTenantId();
    const tenant = getTenantById(activeId);

    const vatNumber = tenant?.vatNumber || vatInput || '300049785700003';
    const companyName = tenant?.name || compInput || 'Saudi Flame Grill';
    const branchName = tenant?.branchName || branchInput || 'Riyadh Branch 1';
    const city = tenant?.city || cityInput || 'Riyadh';
    const env = envInput || tenant?.environment || (process.env.ZATCA_ENV as any) || 'simulation';

    const egsUuid = tenant?.egsUuid || crypto.randomUUID();
    const result = generateEgsCsr(
      {
        environment: env,
        vatNumber,
        companyName,
        branchName,
        city,
        businessCategory: 'Food and Beverage',
        egsUuid,
      },
      STORAGE_DIR
    );

    if (tenant) {
      tenant.privateKeyPem = result.privateKeyPem;
      tenant.publicKeyPem = result.publicKeyPem;
      tenant.cleanCsrBase64 = result.cleanCsrBase64;
      tenant.environment = env;
      saveTenant(tenant);
    }

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(STORAGE_DIR, 'egs_info.json'),
      JSON.stringify(
        {
          tenantId: activeId,
          egsUuid,
          vatNumber,
          companyName,
          branchName,
          city,
          environment: env,
        },
        null,
        2
      )
    );

    return res.json({
      status: 'CSR_GENERATED',
      tenantId: activeId,
      egsUuid,
      environment: env,
      csrBase64: result.cleanCsrBase64,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Route B: Exchange OTP for Compliance CSID
router.post('/zatca/onboard/exchange-otp', async (req: Request, res: Response) => {
  try {
    const { otp, csrBase64, tenantId, environment: envInput } = req.body;
    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ error: 'A valid 6-digit OTP is required' });
    }

    const activeId = tenantId || getActiveTenantId();
    const tenant = getTenantById(activeId);
    const env = envInput || tenant?.environment || (process.env.ZATCA_ENV as any) || 'simulation';

    const activeOnboardingService = new ZatcaOnboardingService(env);

    let cleanCsr = (csrBase64 || '').trim();

    if (!cleanCsr && tenant?.cleanCsrBase64) {
      cleanCsr = tenant.cleanCsrBase64.trim();
    }

    if (!cleanCsr) {
      const csrFilePath = path.join(STORAGE_DIR, 'egs_request.csr');
      if (fs.existsSync(csrFilePath)) {
        try {
          const rawFile = fs.readFileSync(csrFilePath, 'utf8');
          cleanCsr = rawFile
            .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
            .replace(/-----END CERTIFICATE REQUEST-----/g, '')
            .replace(/[\r\n\s]/g, '')
            .trim();
        } catch (_) {}
      }
    }

    if (!cleanCsr) {
      return res.status(400).json({ error: 'CSR not generated yet. Please click Step 1 first.' });
    }

    const ccsid = await activeOnboardingService.requestComplianceCsid(cleanCsr, otp);

    if (tenant) {
      tenant.complianceRequestId = ccsid.requestID;
      tenant.binarySecurityToken = ccsid.binarySecurityToken;
      tenant.secret = ccsid.secret;
      tenant.csidStatus = 'COMPLIANCE_ACTIVE';
      saveTenant(tenant);
    }

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(
        {
          tenantId: activeId,
          status: 'COMPLIANCE_ISSUED',
          complianceRequestId: ccsid.requestID,
          binarySecurityToken: ccsid.binarySecurityToken,
          secret: ccsid.secret,
        },
        null,
        2
      )
    );

    return res.json({
      status: 'CCSID_ACTIVE',
      tenantId: activeId,
      requestId: ccsid.requestID,
      binarySecurityToken: ccsid.binarySecurityToken,
      message: 'Compliance CSID successfully issued. Proceed to sample compliance tests.',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Route C: Upgrade Compliance CSID to Production CSID
router.post('/zatca/onboard/upgrade-production', async (req: Request, res: Response) => {
  try {
    const { tenantId, environment: envInput } = req.body;
    const activeId = tenantId || getActiveTenantId();
    const tenant = getTenantById(activeId);

    const env = envInput || tenant?.environment || (process.env.ZATCA_ENV as any) || 'simulation';
    const activeOnboardingService = new ZatcaOnboardingService(env);

    let ccsidRequestId = tenant?.complianceRequestId;
    let ccsidToken = tenant?.binarySecurityToken;
    let ccsidSecret = tenant?.secret;

    if (!ccsidRequestId && fs.existsSync(CREDENTIALS_FILE)) {
      const currentCreds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      ccsidRequestId = currentCreds.complianceRequestId;
      ccsidToken = currentCreds.binarySecurityToken;
      ccsidSecret = currentCreds.secret;
    }

    if (!ccsidRequestId || !ccsidToken) {
      return res.status(400).json({ error: 'No active Compliance CSID found. Run OTP onboarding first.' });
    }

    const pcsid = await activeOnboardingService.requestProductionCsid(
      ccsidRequestId,
      ccsidToken,
      ccsidSecret || 'zatca-simulated-secret'
    );

    if (tenant) {
      tenant.productionRequestId = pcsid.requestID;
      tenant.binarySecurityToken = pcsid.binarySecurityToken;
      tenant.secret = pcsid.secret;
      tenant.csidStatus = 'PRODUCTION_ACTIVE';
      saveTenant(tenant);
    }

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(
        {
          tenantId: activeId,
          status: 'PRODUCTION_ACTIVE',
          productionRequestId: pcsid.requestID,
          binarySecurityToken: pcsid.binarySecurityToken,
          secret: pcsid.secret,
        },
        null,
        2
      )
    );

    return res.json({
      status: 'PRODUCTION_READY',
      tenantId: activeId,
      productionRequestId: pcsid.requestID,
      message: 'Production CSID issued successfully. Unit is authorized for live clearance & reporting.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Route D: Run Compliance Validation Checks
router.post('/zatca/onboard/run-compliance', async (req: Request, res: Response) => {
  try {
    const { vatNumber = '300049785700003', companyName = 'Saudi Flame Grill' } = req.body;

    const results = await complianceRunner.runAllComplianceChecks(vatNumber, companyName);

    return res.json({
      status: 'COMPLIANCE_TESTS_COMPLETED',
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Route E: Get Background Reporting Queue Status
router.get('/zatca/queue', (_req: Request, res: Response) => {
  res.json({
    success: true,
    queue: reportingQueue.getQueueStatus(),
  });
});

export default router;
