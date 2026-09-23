export interface TaxpayerDetails {
  taxpayerName: string;
  vatNumber: string; // 15 digits starting and ending with 3
  branchName: string;
  city: string;
  otp?: string;
  crNumber?: string; // Commercial Registration
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
  icv: number; // Invoice Counter Value
  pih: string; // Previous Invoice Hash (Base64)
  lastUpdated: string;
}

export interface LineItem {
  id: string;
  itemName: string;
  itemNameArabic?: string;
  quantity: number;
  unitPrice: number; // In SAR
  discount?: number; // In SAR
  vatCategory: 'S' | 'Z' | 'E' | 'O'; // Standard (15%), Zero-rated (0%), Exempt, Out of scope
  vatRate: number; // e.g. 15 for S, 0 for others
}

export interface CustomerDetails {
  buyerName: string;
  buyerVatNumber: string; // 15 digits
  buyerStreet: string;
  buyerBuildingNumber: string;
  buyerDistrict: string;
  buyerCity: string;
  buyerPostalCode: string;
  buyerCountry: string;
}

export interface InvoiceRequest {
  invoiceType: '0200000' | '0100000'; // 0200000 = Simplified (B2C), 0100000 = Standard (B2B)
  invoiceSubType: '388'; // 388 = Tax Invoice
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
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
  invoiceNumber: string; // e.g. INV-2026-00001
  icv: number;
  pih: string; // Previous Invoice Hash
  invoiceHash: string; // Current Invoice Hash (Base64)
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
