import React, { useState } from 'react';
import { EGSState, InvoiceRequest, LineItem, GeneratedInvoiceResponse, CompanyTenant } from '../types';
import { Language, translations } from '../i18n';
import { ReceiptPreview } from './ReceiptPreview';
import { FileCode2, Plus, Trash2, ShieldCheck, ShoppingCart, Send, User, Sparkles, Building2, FileSpreadsheet, Store } from 'lucide-react';

interface POSSimulatorTabProps {
  egsState: EGSState | null;
  activeTenant?: CompanyTenant | null;
  onGenerateInvoice: (req: InvoiceRequest & { tenantId?: string }) => Promise<GeneratedInvoiceResponse>;
  onOpenQRDecoder: (base64TLV: string) => void;
  isLoading: boolean;
  lang: Language;
}

export const POSSimulatorTab: React.FC<POSSimulatorTabProps> = ({
  egsState,
  activeTenant,
  onGenerateInvoice,
  onOpenQRDecoder,
  isLoading,
  lang,
}) => {
  const t = translations[lang];

  const [invoiceType, setInvoiceType] = useState<'0200000' | '0100000'>('0200000'); // 0200000 = Simplified B2C
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [issueTime, setIssueTime] = useState<string>(
    new Date().toTimeString().split(' ')[0]
  );

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      itemName: 'وجبة شاورما دجاج جامبو / Chicken Shawarma Combo',
      quantity: 2,
      unitPrice: 22.0,
      vatCategory: 'S',
      vatRate: 15,
      discount: 0,
    },
    {
      id: '2',
      itemName: 'بطاطس مقلية عائلي / Family French Fries',
      quantity: 1,
      unitPrice: 12.0,
      vatCategory: 'S',
      vatRate: 15,
      discount: 0,
    },
  ]);

  // Customer / Buyer details for B2B
  const [buyerName, setBuyerName] = useState<string>('شركة الشرق للحلول التقنية');
  const [buyerVatNumber, setBuyerVatNumber] = useState<string>('311122233300003');
  const [buyerCity, setBuyerCity] = useState<string>('جدة');
  const [buyerPostalCode, setBuyerPostalCode] = useState<string>('21589');

  const [generatedInvoice, setGeneratedInvoice] = useState<GeneratedInvoiceResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Totals calculations
  const subtotalSAR = lineItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice - (item.discount || 0),
    0
  );
  const vatTotalSAR = subtotalSAR * 0.15;
  const grandTotalSAR = subtotalSAR + vatTotalSAR;

  const handleAddItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        itemName: 'صنف جديد / New Item',
        quantity: 1,
        unitPrice: 25.0,
        vatCategory: 'S',
        vatRate: 15,
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const isJson = file.name.endsWith('.json');

      try {
        const res = await fetch('/api/invoice/import-pos-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContent: content,
            fileType: isJson ? 'json' : 'csv',
          }),
        });
        const data = await res.json();
        if (data.success && data.lineItems?.length > 0) {
          setLineItems(data.lineItems);
          const msg = lang === 'ar'
            ? `تم استيراد ${data.importedCount} صنف بنجاح من ملف الـ POS (${file.name})!`
            : `Successfully imported ${data.importedCount} items from POS file (${file.name})!`;
          setImportNotice(msg);
          setTimeout(() => setImportNotice(null), 5000);
        } else {
          alert(data.error || 'فشل قراءة الملف');
        }
      } catch (err) {
        alert('حدث خطأ أثناء تحميل الملف');
      }
    };

    reader.readAsText(file);
  };

  const handleLoadCoffeePreset = () => {
    setInvoiceType('0200000');
    setLineItems([
      { id: '1', itemName: 'وجبة شاورما دجاج جامبو', quantity: 2, unitPrice: 22.0, vatCategory: 'S', vatRate: 15, discount: 0 },
      { id: '2', itemName: 'بطاطس مقلية عائلي', quantity: 1, unitPrice: 12.0, vatCategory: 'S', vatRate: 15, discount: 0 },
      { id: '3', itemName: 'مشروب غازي بيبسي', quantity: 2, unitPrice: 5.0, vatCategory: 'S', vatRate: 15, discount: 0 },
    ]);
  };

  const handleLoadITPreset = () => {
    setInvoiceType('0100000');
    setBuyerName('شركة التقنية العربية المتقدمة');
    setBuyerVatNumber('311122233300003');
    setLineItems([
      { id: '1', itemName: 'استشارات بنية تحتية سحابية', quantity: 10, unitPrice: 450.0, vatCategory: 'S', vatRate: 15, discount: 0 },
      { id: '2', itemName: 'ترخيص شهادات الأمان الرقمية', quantity: 1, unitPrice: 1200.0, vatCategory: 'S', vatRate: 15, discount: 0 },
    ]);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (lineItems.length === 0) {
      setFormError('At least one line item is required.');
      return;
    }

    if (invoiceType === '0100000') {
      if (!buyerName.trim()) {
        setFormError('Buyer Name is required for Standard B2B invoices.');
        return;
      }
      if (!/^3\d{13}3$/.test(buyerVatNumber.trim())) {
        setFormError('Buyer VAT Number must be 15 digits starting & ending with 3.');
        return;
      }
    }

    const req: InvoiceRequest & { tenantId?: string } = {
      tenantId: activeTenant?.id,
      invoiceType,
      invoiceSubType: '388',
      issueDate,
      issueTime,
      lineItems,
      customer:
        invoiceType === '0100000'
          ? {
              buyerName: buyerName.trim(),
              buyerVatNumber: buyerVatNumber.trim(),
              buyerStreet: 'طريق الملك عبد العزيز',
              buyerBuildingNumber: '1102',
              buyerDistrict: 'الشاطئ',
              buyerCity: buyerCity.trim() || 'جدة',
              buyerPostalCode: buyerPostalCode.trim() || '21589',
              buyerCountry: 'SA',
            }
          : undefined,
    };

    try {
      const result = await onGenerateInvoice(req);
      setGeneratedInvoice(result);
    } catch (err: any) {
      setFormError(err?.message || 'Invoice generation failed.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">{t.posTitle}</h2>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">{t.posDesc}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadCoffeePreset}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.coffeePreset}</span>
            </button>
            <button
              type="button"
              onClick={handleLoadITPreset}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.itPreset}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Tenant Indicator & POS File Upload Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800 gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'ar' ? 'المنشأة المصدرة للفاتورة:' : 'Issuing Organization:'}
            </h4>
            <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
              <span>{activeTenant?.name || egsState?.taxpayer?.taxpayerName}</span>
              <span className="text-xs text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                VAT: {activeTenant?.vatNumber || egsState?.taxpayer?.vatNumber}
              </span>
            </p>
          </div>
        </div>

        {/* POS File Import Dropzone / Button */}
        <label className="cursor-pointer flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2.5 rounded-lg font-semibold transition shadow-md hover:shadow-indigo-900/40">
          <FileSpreadsheet className="w-4 h-4" />
          <span>{lang === 'ar' ? 'استيراد ملف POS / Excel (CSV)' : 'Import POS / Excel CSV'}</span>
          <input
            type="file"
            accept=".csv,.txt,.json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {importNotice && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} className="font-bold text-emerald-400">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Invoice Generator Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          
          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* Classification Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t.selectClassification}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInvoiceType('0200000')}
                  className={`p-4 rounded-xl border text-left rtl:text-right transition ${
                    invoiceType === '0200000'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{t.simplifiedInvoice}</span>
                    <span className="text-[10px] font-mono bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded">
                      0200000 B2C
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{t.simplifiedDesc}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setInvoiceType('0100000')}
                  className={`p-4 rounded-xl border text-left rtl:text-right transition ${
                    invoiceType === '0100000'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/30'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{t.standardInvoice}</span>
                    <span className="text-[10px] font-mono bg-blue-900 text-blue-300 px-2 py-0.5 rounded">
                      0100000 B2B
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{t.standardDesc}</p>
                </button>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t.issueDate}</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t.issueTime}</label>
                <input
                  type="time"
                  step="1"
                  value={issueTime}
                  onChange={(e) => setIssueTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            {/* Buyer Details (for B2B Standard) */}
            {invoiceType === '0100000' && (
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-blue-200/80 pb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-900 uppercase">
                    {t.buyerInfoTitle}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-blue-800 mb-1">{t.buyerName}</label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-blue-800 mb-1">{t.buyerVatNumber}</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={buyerVatNumber}
                      onChange={(e) => setBuyerVatNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-600" />
                  {t.lineItemsTitle}
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addLineItem}</span>
                </button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                        placeholder={t.itemDescription}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 1)
                          }
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-center text-slate-900"
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.5"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-right text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={lineItems.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>{t.subtotalExclVat}:</span>
                <span>{subtotalSAR.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>{t.vat15}:</span>
                <span>+ {vatTotalSAR.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white border-t border-slate-800 pt-2 font-sans">
                <span>{t.grandTotalPayable}:</span>
                <span className="text-emerald-400 font-mono">{grandTotalSAR.toFixed(2)} SAR</span>
              </div>
            </div>

            {formError && (
              <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>{t.submittingToZatca}</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t.submitToZatca}</span>
                </>
              )}
            </button>

          </form>

        </div>

        {/* Receipt Preview Component */}
        <div className="lg:col-span-5">
          {generatedInvoice ? (
            <ReceiptPreview
              invoice={generatedInvoice}
              onOpenQRDecoder={onOpenQRDecoder}
              lang={lang}
            />
          ) : (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Receipt Preview Ready</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Fill in line items and submit to generate the ZATCA Phase 2 thermal receipt with scannable QR code.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
