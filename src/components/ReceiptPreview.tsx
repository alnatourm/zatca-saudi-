import React from 'react';
import { GeneratedInvoiceResponse } from '../types';
import { Language, translations } from '../i18n';
import { Download, Copy, Check, FileText, QrCode, ShieldCheck } from 'lucide-react';

interface ReceiptPreviewProps {
  invoice: GeneratedInvoiceResponse;
  onOpenQRDecoder: (base64TLV: string) => void;
  lang: Language;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ invoice, onOpenQRDecoder, lang }) => {
  const t = translations[lang];
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [copiedXml, setCopiedXml] = React.useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(invoice.invoiceHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(invoice.ublXml);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  const handleDownloadXml = () => {
    const blob = new Blob([invoice.ublXml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${invoice.invoiceNumber}_ZATCA.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isB2B = invoice.invoiceType === '0100000';

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
      
      {/* Header bar */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-sm text-white">{t.receiptTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              invoice.complianceStatus === 'CLEARED'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                : 'bg-blue-950 text-blue-300 border-blue-700/60'
            }`}
          >
            {invoice.complianceStatus === 'CLEARED' ? t.clearedBadge : t.reportedBadge}
          </span>
        </div>
      </div>

      {/* POS Thermal Paper Wrapper */}
      <div className="p-6 bg-slate-950 flex justify-center">
        <div id="receipt-print-area" className="w-full max-w-sm bg-white text-slate-900 p-6 rounded shadow-2xl font-mono text-xs border border-slate-300 space-y-4">
          
          {/* Receipt Top Title */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {isB2B ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}
            </h2>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              {isB2B ? 'Standard Tax Invoice (B2B)' : 'Simplified Tax Invoice (B2C)'}
            </h3>
            <p className="text-[11px] font-bold text-slate-900 mt-1">{invoice.taxpayer.taxpayerName}</p>
            <p className="text-[10px] text-slate-600">
              VAT Registration No: <span className="font-bold text-slate-900">{invoice.taxpayer.vatNumber}</span>
            </p>
            <p className="text-[10px] text-slate-600">
              {invoice.taxpayer.branchName} - {invoice.taxpayer.city}
            </p>
          </div>

          {/* Invoice Metadata */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-600">{t.invoiceNo}:</span>
              <span className="font-bold">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t.dateLabel}:</span>
              <span>{invoice.issueTimestamp.split('T')[0]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t.timeLabel}:</span>
              <span>{invoice.issueTimestamp.split('T')[1]?.replace('Z', '')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t.icvLabel}:</span>
              <span className="font-bold text-emerald-700">#{invoice.icv}</span>
            </div>
          </div>

          {/* Customer info if B2B */}
          {isB2B && invoice.customer && (
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px] space-y-0.5">
              <p className="font-bold text-slate-800 uppercase">{t.buyerInfoHeading}:</p>
              <p><span className="text-slate-500">Name:</span> {invoice.customer.buyerName}</p>
              <p><span className="text-slate-500">VAT No:</span> <span className="font-bold">{invoice.customer.buyerVatNumber}</span></p>
              <p><span className="text-slate-500">City:</span> {invoice.customer.buyerCity}</p>
            </div>
          )}

          {/* Line items table */}
          <div className="space-y-2 py-1">
            <div className="grid grid-cols-12 font-bold text-[10px] uppercase border-b border-slate-300 pb-1">
              <span className="col-span-6">{t.itemColHeader}</span>
              <span className="col-span-2 text-center">{t.qtyColHeader}</span>
              <span className="col-span-4 text-right">{t.totalSarColHeader}</span>
            </div>

            {invoice.lineItems.map((item, idx) => {
              const lineSub = item.quantity * item.unitPrice - (item.discount || 0);
              const lineTotal = lineSub * 1.15;
              return (
                <div key={idx} className="grid grid-cols-12 text-[11px] py-1 border-b border-slate-100">
                  <div className="col-span-6 pr-1 rtl:pl-1 rtl:pr-0">
                    <p className="font-semibold text-slate-900 leading-tight">{item.itemName}</p>
                    <p className="text-[9px] text-slate-500">@{item.unitPrice.toFixed(2)} SAR (15% VAT)</p>
                  </div>
                  <div className="col-span-2 text-center font-bold text-slate-800">
                    {item.quantity}
                  </div>
                  <div className="col-span-4 text-right rtl:text-left font-bold text-slate-900">
                    {lineTotal.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Breakdown */}
          <div className="space-y-1 pt-2 text-[11px] border-t border-slate-300">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (Excl. VAT) / المجموع:</span>
              <span>{invoice.subtotalSAR.toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>VAT 15% / ضريبة القيمة المضافة:</span>
              <span>{invoice.vatTotalSAR.toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1.5 border-t border-slate-900">
              <span>{t.totalPayableAr}:</span>
              <span>{invoice.grandTotalSAR.toFixed(2)} SAR</span>
            </div>
          </div>

          {/* ZATCA Phase 2 Scannable QR Code */}
          <div className="pt-3 pb-2 border-t border-dashed border-slate-300 text-center space-y-2">
            <p className="text-[10px] font-bold text-slate-700 tracking-wider uppercase">
              ZATCA Phase 2 Scannable TLV QR
            </p>

            <div className="inline-block bg-white p-2 rounded border border-slate-300 shadow-sm">
              <img
                src={invoice.qrCodeDataUrl}
                alt="ZATCA Phase 2 Scannable QR Code"
                className="w-44 h-44 mx-auto"
              />
            </div>

            <p className="text-[9px] text-slate-500">
              Contains Base64 TLV Tags 1..9 (Seller, VAT, Time, Total, VAT, Hash, ECDSA Signature)
            </p>
          </div>

          {/* Hash & ICV footer */}
          <div className="bg-slate-100 p-2 rounded text-[9px] font-mono text-slate-600 space-y-1 break-all">
            <p><span className="font-bold text-slate-800">Invoice Hash (SHA-256):</span> {invoice.invoiceHash.slice(0, 28)}...</p>
            <p><span className="font-bold text-slate-800">PIH Chain Ref:</span> {invoice.pih.slice(0, 24)}...</p>
          </div>

        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Download UBL XML */}
          <button
            onClick={handleDownloadXml}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            <span>{t.downloadXml}</span>
          </button>

          {/* Inspect Raw TLV */}
          <button
            onClick={() => onOpenQRDecoder(invoice.qrCodeBase64TLV)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>{t.inspectTlv}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy SHA-256 Hash */}
          <button
            onClick={handleCopyHash}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded border border-slate-700 transition"
          >
            {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedHash ? t.hashCopied : t.copyHash}</span>
          </button>

          {/* Copy XML */}
          <button
            onClick={handleCopyXml}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded border border-slate-700 transition"
          >
            {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
            <span>{copiedXml ? t.xmlCopied : t.copyXml}</span>
          </button>
        </div>

      </div>

    </div>
  );
};
