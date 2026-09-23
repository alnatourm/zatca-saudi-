import { generateZATCAUBL21Xml, ZATCAXMLInput } from '../xmlBuilder';
import { InvoiceRequest, TaxpayerDetails } from './types';

export function buildZATCAUBLXml(params: {
  invoiceNumber: string;
  uuid: string;
  icv: number;
  pih: string;
  invoiceHashBase64?: string;
  qrCodeBase64TLV: string;
  digitalSignatureBase64: string;
  request: InvoiceRequest;
  taxpayer: TaxpayerDetails;
  subtotalSAR: number;
  vatTotalSAR: number;
  grandTotalSAR: number;
  includeSignatureBlocks?: boolean;
}): string {
  return generateZATCAUBL21Xml(params as ZATCAXMLInput);
}
