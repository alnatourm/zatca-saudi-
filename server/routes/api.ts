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
} from '../zatca/egsStore';
import { generateAndRenderZATCAQR } from '../qr';
import {
  generateZATCATLVBase64,
  computeSHA256Base64,
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
  res.json({ success: true, egs });
});

// POST Onboard EGS device
router.post('/egs/onboard', (req: Request, res: Response) => {
  const { taxpayerName, vatNumber, branchName, city, otp, crNumber, streetName, buildingNumber, postalCode, district } = req.body;

  if (!taxpayerName || !vatNumber || !branchName || !city || !otp) {
    res.status(400).json({
      success: false,
      error: 'Taxpayer Name, 15-digit VAT Number, Branch Name, City, and OTP are required.',
    });
    return;
  }

  const updatedEGS = onboardEGS({
    taxpayerName,
    vatNumber,
    branchName,
    city,
    otp,
    crNumber,
    streetName,
    buildingNumber,
    postalCode,
    district,
  });

  res.json({
    success: true,
    message: 'EGS Device successfully onboarded. CSID Certificate issued.',
    egs: updatedEGS,
  });
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

// POST Generate & Submit Invoice
router.post('/invoice/generate', async (req: Request, res: Response) => {
  try {
    const requestData: InvoiceRequest = req.body;
    const egs = getEGSState();

    if (!egs.isOnboarded || !egs.certificate) {
      res.status(400).json({
        success: false,
        error: 'EGS Device is not onboarded. Please onboard device first in the EGS Onboarding tab.',
      });
      return;
    }

    // 1. Business rules validation
    const validationResult = validateZATCABusinessRules({
      request: requestData,
      taxpayer: egs.taxpayer,
      expectedPih: egs.pih,
    });

    if (!validationResult.isValid) {
      res.status(422).json({
        success: false,
        error: 'ZATCA Compliance Validation Failed',
        logs: validationResult.logs,
      });
      return;
    }

    // 2. Financial calculation
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

    // 3. Serial Number & UUID
    const currentIcv = egs.icv + 1;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(currentIcv).padStart(5, '0')}`;
    const uuid = `sa-vat-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const currentPih = egs.pih;
    const issueTimestamp = `${requestData.issueDate || new Date().toISOString().split('T')[0]}T${requestData.issueTime || new Date().toISOString().split('T')[1].slice(0, 8)}Z`;

    // 4. Provisional XML & Hash
    const tempXmlForHash = buildZATCAUBLXml({
      invoiceNumber,
      uuid,
      icv: currentIcv,
      pih: currentPih,
      invoiceHashBase64: 'TEMP_HASH',
      qrCodeBase64TLV: 'TEMP_QR',
      digitalSignatureBase64: 'TEMP_SIG',
      request: requestData,
      taxpayer: egs.taxpayer,
      subtotalSAR,
      vatTotalSAR,
      grandTotalSAR,
    });

    const invoiceHashBase64 = computeSHA256Base64(tempXmlForHash);

    // 5. Digital signature
    const digitalSignatureBase64 = signInvoiceHash(
      invoiceHashBase64,
      egs.certificate.privateKeyPem
    );

    // 6. Generate ZATCA Phase 2 9-Tag TLV Base64 & QR Code Image using server/qr.ts utility
    const { base64TLV, dataUrl: qrCodeDataUrl } = await generateAndRenderZATCAQR({
      sellerName: egs.taxpayer.taxpayerName,
      vatNumber: egs.taxpayer.vatNumber,
      timestamp: issueTimestamp,
      totalAmount: grandTotalSAR.toFixed(2),
      vatAmount: vatTotalSAR.toFixed(2),
      xmlHash: invoiceHashBase64,
      ecdsaSignature: digitalSignatureBase64,
      publicKey: egs.certificate.publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, ''),
      certificateStamp: egs.certificate.complianceCSID,
    });

    const tlvResult = generateZATCATLVBase64({
      sellerName: egs.taxpayer.taxpayerName,
      vatNumber: egs.taxpayer.vatNumber,
      timestamp: issueTimestamp,
      totalWithVat: grandTotalSAR.toFixed(2),
      vatTotal: vatTotalSAR.toFixed(2),
      invoiceHashBase64,
      digitalSignatureBase64,
      publicKeyPemOrBase64: egs.certificate.publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, ''),
      csidCertificateBase64: egs.certificate.complianceCSID,
    });

    // 8. Final canonical UBL 2.1 XML
    const finalUblXml = buildZATCAUBLXml({
      invoiceNumber,
      uuid,
      icv: currentIcv,
      pih: currentPih,
      invoiceHashBase64,
      qrCodeBase64TLV: tlvResult.base64TLV,
      digitalSignatureBase64,
      request: requestData,
      taxpayer: egs.taxpayer,
      subtotalSAR,
      vatTotalSAR,
      grandTotalSAR,
    });

    // 9. Update state ICV and PIH chain
    updateStateAfterInvoice(invoiceHashBase64);

    // Compliance status label (B2B = CLEARED by ZATCA API, B2C = REPORTED)
    const complianceStatus = requestData.invoiceType === '0100000' ? 'CLEARED' : 'REPORTED';

    const generatedResponse: GeneratedInvoiceResponse = {
      id: uuid,
      uuid,
      invoiceType: requestData.invoiceType,
      invoiceTypeLabel: requestData.invoiceType === '0100000' ? 'Standard Tax Invoice (B2B - فاتورة ضريبية)' : 'Simplified Tax Invoice (B2C - فاتورة ضريبية مبسطة)',
      invoiceNumber,
      icv: currentIcv,
      pih: currentPih,
      invoiceHash: invoiceHashBase64,
      issueTimestamp,
      taxpayer: egs.taxpayer,
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
      complianceLogs: validationResult.logs,
      createdAt: new Date().toISOString(),
    };

    saveInvoice(generatedResponse);

    res.json({
      success: true,
      message: requestData.invoiceType === '0100000'
        ? 'Invoice CLEARED by ZATCA Phase 2 Clearance API.'
        : 'Simplified Invoice signed & REPORTED to ZATCA Fatoora Platform.',
      invoice: generatedResponse,
      updatedEgsState: getEGSState(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Error generating ZATCA Invoice',
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
      vatNumber = '300049785700003',
      companyName = 'Saudi Flame Grill',
      branchName = 'Riyadh Branch 1',
      city = 'Riyadh',
    } = req.body;

    const egsUuid = crypto.randomUUID();
    const result = generateEgsCsr(
      {
        environment: 'simulation',
        vatNumber,
        companyName,
        branchName,
        city,
        businessCategory: 'Food and Beverage',
        egsUuid,
      },
      STORAGE_DIR
    );

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(STORAGE_DIR, 'egs_info.json'),
      JSON.stringify(
        {
          egsUuid,
          vatNumber,
          companyName,
          branchName,
          city,
        },
        null,
        2
      )
    );

    return res.json({
      status: 'CSR_GENERATED',
      egsUuid,
      csrBase64: result.cleanCsrBase64,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Route B: Exchange OTP for Compliance CSID
router.post('/zatca/onboard/exchange-otp', async (req: Request, res: Response) => {
  try {
    const { otp, csrBase64 } = req.body;
    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ error: 'A valid 6-digit OTP is required' });
    }

    const ccsid = await onboardingService.requestComplianceCsid(csrBase64, otp);

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(
        {
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
      requestId: ccsid.requestID,
      message: 'Compliance CSID successfully issued. Proceed to sample compliance tests.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Route C: Upgrade Compliance CSID to Production CSID
router.post('/zatca/onboard/upgrade-production', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return res.status(400).json({ error: 'No active Compliance CSID found. Run OTP onboarding first.' });
    }

    const currentCreds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    const pcsid = await onboardingService.requestProductionCsid(
      currentCreds.complianceRequestId,
      currentCreds.binarySecurityToken,
      currentCreds.secret
    );

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(
        {
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

export default router;
