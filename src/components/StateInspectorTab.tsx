import React, { useState } from 'react';
import { EGSState, GeneratedInvoiceResponse } from '../types';
import { Language, translations } from '../i18n';
import { Hash, Key, RefreshCw, QrCode, FileText, Download, ShieldCheck, Database, FileCode2, ArrowRight } from 'lucide-react';

interface StateInspectorTabProps {
  egsState: EGSState | null;
  invoiceList: GeneratedInvoiceResponse[];
  onResetState: () => Promise<void>;
  onOpenQRDecoder: (base64TLV: string) => void;
  isLoading: boolean;
  lang: Language;
}

export const StateInspectorTab: React.FC<StateInspectorTabProps> = ({
  egsState,
  invoiceList,
  onResetState,
  onOpenQRDecoder,
  isLoading,
  lang,
}) => {
  const t = translations[lang];

  const [selectedInvoice, setSelectedInvoice] = useState<GeneratedInvoiceResponse | null>(
    invoiceList.length > 0 ? invoiceList[0] : null
  );

  const handleExportLedgerJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(invoiceList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ZATCA_Audit_Ledger_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">{t.inspectorTitle}</h2>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">{t.inspectorDesc}</p>
          </div>

          <div className="flex items-center gap-2">
            {invoiceList.length > 0 && (
              <button
                type="button"
                onClick={handleExportLedgerJson}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{t.exportLedgerJson}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onResetState}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 px-3 py-2 rounded-lg text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t.resetIcvButton}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Metric Inspector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: ICV Counter */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.icvCardTitle}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Hash className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {egsState?.icv ?? 0}
            </span>
            <span className="text-xs text-slate-500 font-medium">{t.invoicesSigned}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Monotonically increasing integer incremented by 1 for every signed UBL invoice.
          </p>
        </div>

        {/* Card 2: PIH Previous Invoice Hash */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.pihCardTitle}
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="font-mono text-xs text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 break-all">
              {egsState?.pih || 'NWZlY2ViO... (Genesis Hash)'}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            SHA-256 hash of the immediate prior invoice. Prevents deletion or out-of-order insertion.
          </p>
        </div>

        {/* Card 3: Certificate Status */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.csidCardTitle}
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Key className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                egsState?.isOnboarded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-sm font-bold text-slate-900">
              {egsState?.isOnboarded ? 'ACTIVE & VALID' : 'PENDING ONBOARDING'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            CSID serial: <span className="font-mono text-slate-700">{egsState?.certificate?.serialNumber || 'N/A'}</span>
          </p>
        </div>

      </div>

      {/* Sequential Hash Chain Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              {t.auditLedgerTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every row is cryptographically linked to the preceding row's SHA-256 hash.
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
            {invoiceList.length} Invoices
          </span>
        </div>

        {invoiceList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileCode2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">{t.noLedgerRecords}</p>
            <p className="text-xs text-slate-500">Use the POS Simulator tab to generate and sign your first invoice.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">ICV</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Total (SAR)</th>
                  <th className="py-3 px-4">SHA-256 Hash</th>
                  <th className="py-3 px-4 text-right rtl:text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {invoiceList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-emerald-700">#{inv.icv}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] rounded font-sans font-semibold ${
                          inv.invoiceType === '0100000'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {inv.invoiceType === '0100000' ? 'B2B Standard' : 'B2C Simplified'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.issueTimestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {inv.grandTotalSAR.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[10px] max-w-xs truncate">
                      {inv.invoiceHash}
                    </td>
                    <td className="py-3 px-4 text-right rtl:text-left space-x-2 rtl:space-x-reverse font-sans">
                      <button
                        onClick={() => onOpenQRDecoder(inv.qrCodeBase64TLV)}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-semibold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition text-[11px]"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                        <span>QR</span>
                      </button>

                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition text-[11px]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>XML</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Selected Invoice Full Details Drawer / Modal */}
      {selectedInvoice && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 text-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-sm">
                Signed Invoice Details - {selectedInvoice.invoiceNumber} (ICV #{selectedInvoice.icv})
              </h4>
            </div>
            <button
              onClick={() => setSelectedInvoice(null)}
              className="text-xs text-slate-400 hover:text-white underline font-medium"
            >
              {t.closeDetails}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">SHA-256 Canonical Invoice Digest:</label>
              <p className="font-mono text-xs text-emerald-300 bg-slate-950 p-2.5 rounded border border-slate-800 break-all">
                {selectedInvoice.invoiceHash}
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">ECDSA Digital Signature (Base64):</label>
              <p className="font-mono text-[10px] text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 break-all max-h-24 overflow-y-auto">
                {selectedInvoice.digitalSignatureBase64}
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Minified UBL 2.1 XML String:</label>
              <pre className="font-mono text-[10px] text-emerald-400/90 bg-slate-950 p-3 rounded border border-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                {selectedInvoice.ublXml}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
