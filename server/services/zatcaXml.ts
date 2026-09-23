import { v4 as uuidv4 } from 'uuid';

export interface ZatcaXmlLine {
  name: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
}

export interface ZatcaXmlParams {
  invoiceNumber: string;
  issueDate: string;  // YYYY-MM-DD
  issueTime: string;  // HH:mm:ss
  isSimplified: boolean;
  invoiceTypeCode?: string; // '388' (Invoice), '381' (Credit Note), '383' (Debit Note)
  billingReferenceId?: string; // Original invoice ID if credit/debit note
  icv: number;        // Monotonic counter (1, 2, 3...)
  pih: string;        // Previous Invoice Hash (Base64)
  sellerVat: string;  // 15-digit number
  sellerName: string;
  street?: string;
  buildingNumber?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  lines: Array<ZatcaXmlLine>;
}

export function buildZatcaXml(params: ZatcaXmlParams) {
  const uuid = uuidv4();
  const subType = params.isSimplified ? '0200000' : '0100000';
  const docTypeCode = params.invoiceTypeCode || '388';

  let totalNet = 0;
  let totalVat = 0;

  const linesXml = params.lines.map((item, idx) => {
    const net = Number((item.quantity * item.unitPrice).toFixed(2));
    const vat = Number((net * (item.vatPercent / 100)).toFixed(2));
    const gross = Number((net + vat).toFixed(2));
    totalNet += net;
    totalVat += vat;

    return `<cac:InvoiceLine>` +
      `<cbc:ID>${idx + 1}</cbc:ID>` +
      `<cbc:InvoicedQuantity unitCode="PCE">${item.quantity.toFixed(2)}</cbc:InvoicedQuantity>` +
      `<cbc:LineExtensionAmount currencyID="SAR">${net.toFixed(2)}</cbc:LineExtensionAmount>` +
      `<cac:TaxTotal>` +
        `<cbc:TaxAmount currencyID="SAR">${vat.toFixed(2)}</cbc:TaxAmount>` +
        `<cbc:RoundingAmount currencyID="SAR">${gross.toFixed(2)}</cbc:RoundingAmount>` +
      `</cac:TaxTotal>` +
      `<cac:Item>` +
        `<cbc:Name>${item.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</cbc:Name>` +
        `<cac:ClassifiedTaxCategory>` +
          `<cbc:ID>S</cbc:ID>` +
          `<cbc:Percent>${item.vatPercent.toFixed(2)}</cbc:Percent>` +
          `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>` +
        `</cac:ClassifiedTaxCategory>` +
      `</cac:Item>` +
      `<cac:Price>` +
        `<cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>` +
      `</cac:Price>` +
    `</cac:InvoiceLine>`;
  }).join('');

  totalNet = Number(totalNet.toFixed(2));
  totalVat = Number(totalVat.toFixed(2));
  const payableAmount = Number((totalNet + totalVat).toFixed(2));

  const billingRefXml = params.billingReferenceId
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${params.billingReferenceId}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
`<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ` +
`xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" ` +
`xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" ` +
`xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
`<cbc:ProfileID>reporting:1.0</cbc:ProfileID>` +
`<cbc:ID>${params.invoiceNumber}</cbc:ID>` +
`<cbc:UUID>${uuid}</cbc:UUID>` +
`<cbc:IssueDate>${params.issueDate}</cbc:IssueDate>` +
`<cbc:IssueTime>${params.issueTime}</cbc:IssueTime>` +
`<cbc:InvoiceTypeCode name="${subType}">${docTypeCode}</cbc:InvoiceTypeCode>` +
`<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>` +
`<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>` +
billingRefXml +
`<cac:AdditionalDocumentReference>` +
  `<cbc:ID>ICV</cbc:ID>` +
  `<cbc:UUID>${params.icv}</cbc:UUID>` +
`</cac:AdditionalDocumentReference>` +
`<cac:AdditionalDocumentReference>` +
  `<cbc:ID>PIH</cbc:ID>` +
  `<cac:Attachment>` +
    `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${params.pih}</cbc:EmbeddedDocumentBinaryObject>` +
  `</cac:Attachment>` +
`</cac:AdditionalDocumentReference>` +
`<cac:AccountingSupplierParty>` +
  `<cac:Party>` +
    `<cac:PartyIdentification><cbc:ID schemeID="CRN">${params.sellerVat}</cbc:ID></cac:PartyIdentification>` +
    `<cac:PostalAddress>` +
      `<cbc:StreetName>${params.street || 'King Fahd Road'}</cbc:StreetName>` +
      `<cbc:BuildingNumber>${params.buildingNumber || '1234'}</cbc:BuildingNumber>` +
      `<cbc:CitySubdivisionName>${params.district || 'Olaya'}</cbc:CitySubdivisionName>` +
      `<cbc:CityName>${params.city || 'Riyadh'}</cbc:CityName>` +
      `<cbc:PostalZone>${params.postalCode || '12211'}</cbc:PostalZone>` +
      `<cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>` +
    `</cac:PostalAddress>` +
    `<cac:PartyTaxScheme>` +
      `<cbc:CompanyID>${params.sellerVat}</cbc:CompanyID>` +
      `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>` +
    `</cac:PartyTaxScheme>` +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${params.sellerName}</cbc:RegistrationName></cac:PartyLegalEntity>` +
  `</cac:Party>` +
`</cac:AccountingSupplierParty>` +
`<cac:AccountingCustomerParty>` +
  `<cac:Party>` +
    `<cac:PartyLegalEntity><cbc:RegistrationName>عميل نقدي</cbc:RegistrationName></cac:PartyLegalEntity>` +
  `</cac:Party>` +
`</cac:AccountingCustomerParty>` +
`<cac:PaymentMeans><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode></cac:PaymentMeans>` +
`<cac:TaxTotal>` +
  `<cbc:TaxAmount currencyID="SAR">${totalVat.toFixed(2)}</cbc:TaxAmount>` +
  `<cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="SAR">${totalNet.toFixed(2)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="SAR">${totalVat.toFixed(2)}</cbc:TaxAmount>` +
    `<cac:TaxCategory>` +
      `<cbc:ID>S</cbc:ID>` +
      `<cbc:Percent>15.00</cbc:Percent>` +
      `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>` +
    `</cac:TaxCategory>` +
  `</cac:TaxSubtotal>` +
`</cac:TaxTotal>` +
`<cac:LegalMonetaryTotal>` +
  `<cbc:LineExtensionAmount currencyID="SAR">${totalNet.toFixed(2)}</cbc:LineExtensionAmount>` +
  `<cbc:TaxExclusiveAmount currencyID="SAR">${totalNet.toFixed(2)}</cbc:TaxExclusiveAmount>` +
  `<cbc:TaxInclusiveAmount currencyID="SAR">${payableAmount.toFixed(2)}</cbc:PayableAmount>` +
  `<cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>` +
  `<cbc:PayableAmount currencyID="SAR">${payableAmount.toFixed(2)}</cbc:PayableAmount>` +
`</cac:LegalMonetaryTotal>` +
linesXml +
`</Invoice>`;

  return { xml, uuid, totalNet, totalVat, payableAmount };
}
