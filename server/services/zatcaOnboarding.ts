export interface CsidCredentials {
  requestID: string;
  tokenType?: string;
  binarySecurityToken: string;
  secret: string;
  dispositionMessage?: string;
}

export class ZatcaOnboardingService {
  private baseUrl: string;

  constructor(environment: 'simulation' | 'production' = 'simulation') {
    this.baseUrl =
      environment === 'production'
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
  }

  /**
   * STEP 1: Exchange 6-digit OTP for Compliance CSID (CCSID)
   * Strictly contacts ZATCA. Fails immediately if rejected.
   */
  async requestComplianceCsid(cleanCsrBase64: string, otp: string): Promise<CsidCredentials> {
    const trimmedOtp = (otp || '').trim();

    if (!trimmedOtp || trimmedOtp.length !== 6) {
      throw new Error('ZATCA Error: OTP must be exactly 6 digits issued by the Fatoora Portal.');
    }

    const response = await fetch(`${this.baseUrl}/compliance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Version': 'V2',
        'OTP': trimmedOtp,
      },
      body: JSON.stringify({ csr: cleanCsrBase64 }),
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`ZATCA Raw Network Error (${response.status}): ${rawText}`);
    }

    if (!response.ok) {
      const errMsg = data.message || data.errorMessage || JSON.stringify(data);
      throw new Error(`ZATCA Portal Rejected OTP (${response.status}): ${errMsg}`);
    }

    if (!data.binarySecurityToken || !data.secret) {
      throw new Error(`ZATCA Response Missing Tokens: ${rawText}`);
    }

    return {
      requestID: String(data.requestID || ''),
      tokenType: data.tokenType || 'Compliance',
      binarySecurityToken: data.binarySecurityToken,
      secret: data.secret,
      dispositionMessage: data.dispositionMessage || 'ISSUED',
    };
  }

  /**
   * STEP 2: Submit compliance sample invoices
   * Fails immediately if ZATCA reports any error.
   */
  async submitComplianceInvoice(params: {
    signedXmlBase64: string;
    invoiceHash: string;
    invoiceUuid: string;
    ccsidToken: string;
    secret: string;
  }) {
    const credentials = `${params.ccsidToken}:${params.secret}`;
    const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/compliance/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'ar',
        'Accept-Version': 'V2',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        invoiceHash: params.invoiceHash,
        uuid: params.invoiceUuid,
        invoice: params.signedXmlBase64,
      }),
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`ZATCA Raw Network Error (${response.status}): ${rawText}`);
    }

    if (!response.ok || data.validationResults?.status === 'ERROR') {
      const errList = data.validationResults?.errorMessages || [data.message || rawText];
      throw new Error(`ZATCA Compliance Validation Failed (${response.status}): ${JSON.stringify(errList)}`);
    }

    return data;
  }

  /**
   * STEP 3: Request Production CSID (PCSID)
   * Fails immediately if ZATCA does not return a real PCSID token.
   */
  async requestProductionCsid(
    complianceRequestId: string,
    ccsidToken: string,
    secret: string
  ): Promise<CsidCredentials> {
    const credentials = `${ccsidToken}:${secret}`;
    const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/production/csids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Version': 'V2',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        compliance_request_id: complianceRequestId,
      }),
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`ZATCA Raw Network Error (${response.status}): ${rawText}`);
    }

    if (!response.ok || !data.binarySecurityToken) {
      const errMsg = data.message || data.errorMessage || JSON.stringify(data);
      throw new Error(`ZATCA Rejected Production CSID Issuance (${response.status}): ${errMsg}`);
    }

    return {
      requestID: String(data.requestID || ''),
      tokenType: 'Production',
      binarySecurityToken: data.binarySecurityToken,
      secret: data.secret,
      dispositionMessage: data.dispositionMessage || 'PRODUCTION_ISSUED',
    };
  }
}
