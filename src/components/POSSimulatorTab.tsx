import React, { useState } from 'react';
import { EGSState, InvoiceRequest, LineItem, GeneratedInvoiceResponse } from '../types';
import { Language, translations } from '../i18n';
import { ReceiptPreview } from './ReceiptPreview';
import { FileCode2, Plus, Trash2, ShieldCheck, ShoppingCart, Send, User, Sparkles, Building2 } from 'lucide-react';

interface POSSimulatorTabProps {
  egsState: EGSState | null;
  onGenerateInvoice: (req: InvoiceRequest) => Promise<GeneratedInvoiceResponse>;
  onOpenQRDecoder: (base64TLV: string) => void;
  isLoading: boolean;
  lang: Language;
}

export const POSSimulatorTab: React.FC<POSSimulatorTabProps> = ({
  egsState,
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
      itemName: 'Espresso Single Origin / إسببريسو',
      quantity: 2,
      unitPrice: 18.0,
      vatCategory: 'S',
      vatRate: 15,
    },
    {
      id: '2',
      itemName: 'Fresh Croissant / كرواسون طازج',
      quantity: 1,
      unitPrice: 14.0,
      vatCategory: 'S',
      vatRate: 15,
    },
  ]);

  // Customer / Buyer details for B2B
  const [buyerName, setBuyerName] = useState<string>('Al-Sharq Enterprises Co');
  const [buyerVatNumber, setBuyerVatNumber] = useState<string>('311122233300003');
  const [buyerCity, setBuyerCity] = useState<string>('Jeddah');
  const [buyerPostalCode, setBuyerPostalCode] = useState<string>('21589');

  const [generatedInvoice, setGeneratedInvoice] = useState<GeneratedInvoiceResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Totals calculations
  const subtotalSAR = lineItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0
  );
  const vatTotalSAR = subtotalSAR * 0.15;
  const grandTotalSAR = subtotalSAR + vatTotalSAR;

  const handleAddItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        itemName: 'New POS Product / منتج جديد',
        quantity: 1,
        unitPrice: 25.0,
        vatCategory: 'S',
        vatRate: 15,
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

  const handleLoadCoffeePreset = () => {
    setInvoiceType('0200000');
    setLineItems([
      { id: '1', itemName: 'Espresso Single Origin', quantity: 2, unitPrice: 18.0, vatCategory: 'S', vatRate: 15 },
      { id: '2', itemName: 'Fresh Bakery Croissant', quantity: 1, unitPrice: 14.0, vatCategory: 'S', vatRate: 15 },
    ]);
  };

  const handleLoadITPreset = () => {
    setInvoiceType('0100000');
    setBuyerName('Al-Enterprise Solutions KSA');
    setBuyerVatNumber('311122233300003');
    setLineItems([
      { id: '1', itemName: 'Cloud Server Infrastructure Consultation', quantity: 10, unitPrice: 450.0, vatCategory: 'S', vatRate: 15 },
      { id: '2', itemName: 'Security SSL Audit License', quantity: 1, unitPrice: 1200.0, vatCategory: 'S', vatRate: 15 },
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

    const req: InvoiceRequest = {
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
              buyerStreet: 'King Abdulaziz Road',
              buyerBuildingNumber: '1102',
              buyerDistrict: 'Al-Shati',
              buyerCity: buyerCity.trim() || 'Jeddah',
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
                {lineItems.map((item, index) => (
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
