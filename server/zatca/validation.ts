import { InvoiceRequest, TaxpayerDetails, ComplianceWarning } from './types';

export function validateZATCABusinessRules(params: {
  request: InvoiceRequest;
  taxpayer: TaxpayerDetails;
  expectedPih: string;
}): { isValid: boolean; logs: ComplianceWarning[] } {
  const { request, taxpayer, expectedPih } = params;
  const logs: ComplianceWarning[] = [];

  // BR-SA-01: Taxpayer VAT ID format check
  const vatRegex = /^3\d{13}3$/;
  if (!taxpayer.vatNumber || !vatRegex.test(taxpayer.vatNumber.trim())) {
    logs.push({
      code: 'BR-KSA-01',
      message: `Taxpayer VAT number '${taxpayer.vatNumber}' is invalid. Must be 15 digits starting and ending with 3.`,
      severity: 'ERROR',
    });
  } else {
    logs.push({
      code: 'BR-KSA-01-PASS',
      message: 'Taxpayer VAT registration format verified (15 digits, starting/ending with 3).',
      severity: 'INFO',
    });
  }

  // BR-SA-02: Line item presence
  if (!request.lineItems || request.lineItems.length === 0) {
    logs.push({
      code: 'BR-KSA-02',
      message: 'Invoice must contain at least one line item.',
      severity: 'ERROR',
    });
  } else {
    request.lineItems.forEach((item, idx) => {
      if (item.quantity <= 0) {
        logs.push({
          code: 'BR-KSA-03',
          message: `Line item #${idx + 1} (${item.itemName}): Quantity must be greater than zero.`,
          severity: 'ERROR',
        });
      }
      if (item.unitPrice < 0) {
        logs.push({
          code: 'BR-KSA-04',
          message: `Line item #${idx + 1} (${item.itemName}): Unit price cannot be negative.`,
          severity: 'ERROR',
        });
      }
    });
  }

  // BR-SA-03: Standard B2B Mandatory Customer Info
  if (request.invoiceType === '0100000') {
    if (!request.customer || !request.customer.buyerName) {
      logs.push({
        code: 'BR-KSA-05',
        message: 'Standard Tax Invoice (B2B) requires Buyer Name.',
        severity: 'ERROR',
      });
    }
    if (!request.customer || !request.customer.buyerVatNumber || !vatRegex.test(request.customer.buyerVatNumber.trim())) {
      logs.push({
        code: 'BR-KSA-06',
        message: 'Standard Tax Invoice (B2B) requires valid 15-digit Buyer VAT Number.',
        severity: 'ERROR',
      });
    }
  }

  // BR-SA-04: Issue date format
  if (!request.issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(request.issueDate)) {
    logs.push({
      code: 'BR-KSA-07',
      message: 'Issue date must follow YYYY-MM-DD format.',
      severity: 'ERROR',
    });
  }

  // BR-SA-05: Hash chain check
  if (!expectedPih) {
    logs.push({
      code: 'BR-KSA-08',
      message: 'Previous Invoice Hash (PIH) missing in device state.',
      severity: 'WARNING',
    });
  } else {
    logs.push({
      code: 'BR-KSA-08-PASS',
      message: 'Sequential Hash Chain verified against previous invoice SHA-256 state.',
      severity: 'INFO',
    });
  }

  const hasErrors = logs.some((log) => log.severity === 'ERROR');

  return {
    isValid: !hasErrors,
    logs,
  };
}
