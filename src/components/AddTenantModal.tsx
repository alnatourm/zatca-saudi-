import React, { useState } from 'react';
import { Language } from '../i18n';
import { Building2, Store, X, PlusCircle } from 'lucide-react';

interface AddTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTenant: (tenantData: {
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
  }) => Promise<void>;
  lang: Language;
}

export const AddTenantModal: React.FC<AddTenantModalProps> = ({
  isOpen,
  onClose,
  onAddTenant,
  lang,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'restaurant' | 'company'>('restaurant');
  const [vatNumber, setVatNumber] = useState('300099887700003');
  const [crNumber, setCrNumber] = useState('1010998877');
  const [branchName, setBranchName] = useState('فرع التخصصي - الرياض');
  const [city, setCity] = useState('الرياض');
  const [district, setDistrict] = useState('المعذر');
  const [streetName, setStreetName] = useState('شارع التخصصي');
  const [buildingNumber, setBuildingNumber] = useState('3310');
  const [postalCode, setPostalCode] = useState('12311');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(lang === 'ar' ? 'يرجى إدخال اسم المنشأة / المطعم' : 'Please enter company/restaurant name');
      return;
    }
    if (!vatNumber || vatNumber.length !== 15 || !vatNumber.startsWith('3') || !vatNumber.endsWith('3')) {
      setError(lang === 'ar' ? 'الرقم الضريبي يجب أن يتكون من 15 خانة ويبدأ وينتهي بالرقم 3' : 'VAT Number must be 15 digits starting & ending with 3');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddTenant({
        name,
        type,
        vatNumber,
        crNumber,
        branchName,
        city,
        district,
        streetName,
        buildingNumber,
        postalCode,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 rtl:left-auto rtl:right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            {type === 'restaurant' ? <Store className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {lang === 'ar' ? 'إضافة منشأة / مطعم جديد' : 'Add New Restaurant / Company'}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'ar' ? 'تخصيص سجل ضريبي وسلسلة تشفير مستقلة' : 'Provision isolated VAT chain & production CSIDs'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/80 border border-red-800 text-red-200 text-xs p-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('restaurant')}
              className={`p-3 rounded-lg border text-right rtl:text-right font-medium flex items-center gap-2 transition ${
                type === 'restaurant'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Store className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold">{lang === 'ar' ? 'مطعم / كافيه (POS)' : 'Restaurant / Cafe'}</div>
                <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'فواتير مبسطة B2C' : 'Simplified B2C Invoices'}</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setType('company')}
              className={`p-3 rounded-lg border text-right rtl:text-right font-medium flex items-center gap-2 transition ${
                type === 'company'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold">{lang === 'ar' ? 'شركة تجارية (B2B)' : 'Commercial Company'}</div>
                <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'فواتير ضريبية B2B' : 'Standard B2B Invoices'}</div>
              </div>
            </button>
          </div>

          {/* Name & VAT Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'اسم المنشأة / المطعم *' : 'Name *'}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: مطعم كودو' : 'e.g. Kudu Restaurant'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'الرقم الضريبي VAT (15 رقم) *' : 'VAT Number (15 digits) *'}</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Branch & CR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'اسم الفرع' : 'Branch Name'}</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'السجل التجاري CR' : 'CR Number'}</label>
              <input
                type="text"
                value={crNumber}
                onChange={(e) => setCrNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Location details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'المدينة' : 'City'}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'الحي' : 'District'}</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'الشارع' : 'Street'}</label>
              <input
                type="text"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-900/40 transition disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? (lang === 'ar' ? 'جاري التسجيل...' : 'Creating...') : (lang === 'ar' ? 'حفظ والتحويل' : 'Save & Switch')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
