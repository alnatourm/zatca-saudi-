export interface CompanyTenant {
  id: string;
  name: string;
  type: 'restaurant' | 'company';
  vatNumber: string;
  crNumber: string;
  branchName: string;
  city: string;
  district: string;
  streetName: string;
  buildingNumber: string;
  postalCode: string;
  egsUuid: string;
  environment: 'simulation' | 'production';
  csidStatus: 'NOT_ONBOARDED' | 'COMPLIANCE_ACTIVE' | 'PRODUCTION_ACTIVE';
  icv: number;
  pih: string;
  createdAt: string;
}

export interface TaxpayerDetails {
  taxpayerName: string;
  vatNumber: string;
  branchName: string;
  city: string;
  otp?: string;
  crNumber?: string;
  streetName?: string;
  buildingNumber?: string;
  postalCode?: string;
  district?: string;
}

export interface CSIDCertificate {
  serialNumber: string;
  issueDate: string;
  expiryDate: string;
  environment: 'Simulation' | 'Sandbox' | 'Production';
  binarySecurityToken: string;
  publicKeyPem: string;
  privateKeyPem: string;
  complianceCSID: string;
  productionCSID: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

export interface EGSState {
  isOnboarded: boolean;
  egsUuid: string;
  taxpayer: TaxpayerDetails;
  certificate: CSIDCertificate | null;
  icv: number;
  pih: string;
  lastUpdated: string;
}

export interface LineItem {
  id: string;
  itemName: string;
  itemNameArabic?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  vatCategory: 'S' | 'Z' | 'E' | 'O';
  vatRate: number;
}

export interface CustomerDetails {
  buyerName: string;
  buyerVatNumber: string;
  buyerStreet: string;
  buyerBuildingNumber: string;
  buyerDistrict: string;
  buyerCity: string;
  buyerPostalCode: string;
  buyerCountry: string;
}

export interface InvoiceRequest {
  invoiceType: '0200000' | '0100000';
  invoiceSubType: '388';
  issueDate: string;
  issueTime: string;
  lineItems: LineItem[];
  customer?: CustomerDetails;
  notes?: string;
}

export interface TLVTag {
  tag: number;
  name: string;
  description: string;
  value: string;
  length: number;
  hexValue: string;
}

export interface ComplianceWarning {
  code: string;
  message: string;
  severity: 'WARNING' | 'INFO' | 'ERROR';
}

export interface GeneratedInvoiceResponse {
  id: string;
  uuid: string;
  invoiceType: '0200000' | '0100000';
  invoiceTypeLabel: string;
  invoiceNumber: string;
  icv: number;
  pih: string;
  invoiceHash: string;
  issueTimestamp: string;
  taxpayer: TaxpayerDetails;
  customer?: CustomerDetails;
  lineItems: LineItem[];
  subtotalSAR: number;
  vatTotalSAR: number;
  grandTotalSAR: number;
  qrCodeBase64TLV: string;
  qrCodeDataUrl: string;
  tlvTags: TLVTag[];
  digitalSignatureBase64: string;
  ublXml: string;
  complianceStatus: 'CLEARED' | 'REPORTED' | 'WARNINGS' | 'REJECTED';
  complianceLogs: ComplianceWarning[];
  createdAt: string;
}

export interface DecodedQRResponse {
  isValidZATCA: boolean;
  rawBase64: string;
  tags: TLVTag[];
  parsedFields: {
    sellerName?: string;
    vatNumber?: string;
    timestamp?: string;
    totalWithVat?: string;
    vatTotal?: string;
    invoiceHash?: string;
    signature?: string;
    publicKey?: string;
    certificateSignature?: string;
  };
}
