import { InvoiceRequest, TaxpayerDetails } from './zatca/types';

export interface ZATCAXMLInput {
  invoiceNumber: string;
  uuid: string;
  icv: number;
  pih: string;
  digitalSignatureBase64: string;
  qrCodeBase64TLV: string;
  request: InvoiceRequest;
  taxpayer: TaxpayerDetails;
  subtotalSAR: number;
  vatTotalSAR: number;
  grandTotalSAR: number;
  includeSignatureBlocks?: boolean; // Set false when generating XML for hashing
}

export function escapeXml(unsafe: string): string {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function minifyXml(xmlString: string): string {
  return xmlString
    .replace(/>\s+</g, '><')
    .replace(/\r?\n|\r/g, '')
    .trim();
}

export function generateZATCAUBL21Xml(input: ZATCAXMLInput): string {
  const {
    invoiceNumber,
    uuid,
    icv,
    pih,
    qrCodeBase64TLV,
    request,
    taxpayer,
    subtotalSAR,
    vatTotalSAR,
    grandTotalSAR,
    includeSignatureBlocks = true
  } = input;

  const typeCodeName = request.invoiceType || '0200000'; // 0200000 = Simplified, 0100000 = Standard

  const lineItemsXml = (request.lineItems || [])
    .map((item, index) => {
      const lineSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      const lineVat = lineSubtotal * (item.vatRate / 100);
      const lineTotal = lineSubtotal + lineVat;

      return `<cac:InvoiceLine>` +
        `<cbc:ID>${index + 1}</cbc:ID>` +
        `<cbc:InvoicedQuantity unitCode="PCE">${item.quantity.toFixed(2)}</cbc:InvoicedQuantity>` +
        `<cbc:LineExtensionAmount currencyID="SAR">${lineSubtotal.toFixed(2)}</cbc:LineExtensionAmount>` +
        `<cac:TaxTotal>` +
          `<cbc:TaxAmount currencyID="SAR">${lineVat.toFixed(2)}</cbc:TaxAmount>` +
          `<cbc:RoundingAmount currencyID="SAR">${lineTotal.toFixed(2)}</cbc:RoundingAmount>` +
        `</cac:TaxTotal>` +
        `<cac:Item>` +
          `<cbc:Name>${escapeXml(item.itemName)}</cbc:Name>` +
          `<cac:ClassifiedTaxCategory>` +
            `<cbc:ID>${item.vatCategory || 'S'}</cbc:ID>` +
            `<cbc:Percent>${(item.vatRate || 15).toFixed(2)}</cbc:Percent>` +
            `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>` +
          `</cac:ClassifiedTaxCategory>` +
        `</cac:Item>` +
        `<cac:Price>` +
          `<cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>` +
        `</cac:Price>` +
      `</cac:InvoiceLine>`;
    })
    .join('');

  const customerXml = request.customer
    ? `<cac:AccountingCustomerParty>` +
        `<cac:Party>` +
          `<cac:PartyIdentification><cbc:ID schemeID="NAT">${request.customer.buyerVatNumber}</cbc:ID></cac:PartyIdentification>` +
          `<cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(request.customer.buyerName)}</cbc:RegistrationName></cac:PartyLegalEntity>` +
        `</cac:Party>` +
      `</cac:AccountingCustomerParty>`
    : `<cac:AccountingCustomerParty>` +
        `<cac:Party>` +
          `<cac:PartyLegalEntity><cbc:RegistrationName>عميل نقدي</cbc:RegistrationName></cac:PartyLegalEntity>` +
        `</cac:Party>` +
      `</cac:AccountingCustomerParty>`;

  const ublExtensionsXml = includeSignatureBlocks
    ? `<ext:UBLExtensions>` +
        `<ext:UBLExtension>` +
          `<ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>` +
          `<ext:ExtensionContent>` +
            `<sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">` +
              `<sac:SignatureInformation>` +
                `<cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>` +
                `<sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>` +
              `</sac:SignatureInformation>` +
            `</sig:UBLDocumentSignatures>` +
          `</ext:ExtensionContent>` +
        `</ext:UBLExtension>` +
      `</ext:UBLExtensions>`
    : '';

  const qrDocRefXml = includeSignatureBlocks && qrCodeBase64TLV
    ? `<cac:AdditionalDocumentReference>` +
        `<cbc:ID>QR</cbc:ID>` +
        `<cac:Attachment>` +
          `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrCodeBase64TLV}</cbc:EmbeddedDocumentBinaryObject>` +
        `</cac:Attachment>` +
      `</cac:AdditionalDocumentReference>`
    : '';

  const signatureXml = includeSignatureBlocks
    ? `<cac:Signature>` +
        `<cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>` +
        `<cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>` +
      `</cac:Signature>`
    : '';

  const rawXml = `<?xml version="1.0" encoding="UTF-8"?>` +
`<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ` +
`xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" ` +
`xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" ` +
`xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
ublExtensionsXml +
`<cbc:ProfileID>reporting:1.0</cbc:ProfileID>` +
`<cbc:ID>${invoiceNumber}</cbc:ID>` +
`<cbc:UUID>${uuid}</cbc:UUID>` +
`<cbc:IssueDate>${request.issueDate}</cbc:IssueDate>` +
`<cbc:IssueTime>${request.issueTime}</cbc:IssueTime>` +
`<cbc:InvoiceTypeCode name="${typeCodeName}">388</cbc:InvoiceTypeCode>` +
`<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>` +
`<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>` +
`<cac:AdditionalDocumentReference>` +
  `<cbc:ID>ICV</cbc:ID>` +
  `<cbc:UUID>${icv}</cbc:UUID>` +
`</cac:AdditionalDocumentReference>` +
`<cac:AdditionalDocumentReference>` +
  `<cbc:ID>PIH</cbc:ID>` +
  `<cac:Attachment>` +
    `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih}</cbc:EmbeddedDocumentBinaryObject>` +
  `</cac:Attachment>` +
`</cac:AdditionalDocumentReference>` +
qrDocRefXml +
signatureXml +
`<cac:AccountingSupplierParty>` +
  `<cac:Party>` +
    `<cac:PartyIdentification><cbc:ID schemeID="CRN">${taxpayer.crNumber || '1010123456'}</cbc:ID></cac:PartyIdentification>` +
    `<cac:PostalAddress>` +
      `<cbc:StreetName>${escapeXml(taxpayer.streetName || 'King Fahd Road')}</cbc:StreetName>` +
      `<cbc:BuildingNumber>${escapeXml(taxpayer.buildingNumber || '7890')}</cbc:BuildingNumber>` +
      `<cbc:CityName>${escapeXml(taxpayer.city)}</cbc:CityName>` +
      `<cbc:PostalZone>${escapeXml(taxpayer.postalCode || '11564')}</cbc:PostalZone>` +
      `<cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>` +
    `</cac:PostalAddress>` +
    `<cac:PartyTaxScheme>` +
      `<cbc:CompanyID>${taxpayer.vatNumber}</cbc:CompanyID>` +
      `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>` +
    `</cac:PartyTaxScheme>` +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(taxpayer.taxpayerName)}</cbc:RegistrationName></cac:PartyLegalEntity>` +
  `</cac:Party>` +
`</cac:AccountingSupplierParty>` +
customerXml +
`<cac:PaymentMeans><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode></cac:PaymentMeans>` +
`<cac:TaxTotal>` +
  `<cbc:TaxAmount currencyID="SAR">${vatTotalSAR.toFixed(2)}</cbc:TaxAmount>` +
  `<cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="SAR">${subtotalSAR.toFixed(2)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="SAR">${vatTotalSAR.toFixed(2)}</cbc:TaxAmount>` +
    `<cac:TaxCategory>` +
      `<cbc:ID>S</cbc:ID>` +
      `<cbc:Percent>15.00</cbc:Percent>` +
      `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>` +
    `</cac:TaxCategory>` +
  `</cac:TaxSubtotal>` +
`</cac:TaxTotal>` +
`<cac:LegalMonetaryTotal>` +
  `<cbc:LineExtensionAmount currencyID="SAR">${subtotalSAR.toFixed(2)}</cbc:LineExtensionAmount>` +
  `<cbc:TaxExclusiveAmount currencyID="SAR">${subtotalSAR.toFixed(2)}</cbc:TaxExclusiveAmount>` +
  `<cbc:TaxInclusiveAmount currencyID="SAR">${grandTotalSAR.toFixed(2)}</cbc:TaxInclusiveAmount>` +
  `<cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>` +
  `<cbc:PayableAmount currencyID="SAR">${grandTotalSAR.toFixed(2)}</cbc:PayableAmount>` +
`</cac:LegalMonetaryTotal>` +
lineItemsXml +
`</Invoice>`;

  return minifyXml(rawXml);
}

// Export alias for backward compatibility
export const buildZATCAUBLXml = generateZATCAUBL21Xml;
