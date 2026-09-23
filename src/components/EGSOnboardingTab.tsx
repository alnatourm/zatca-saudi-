import React, { useState } from 'react';
import { EGSState, TaxpayerDetails } from '../types';
import { Language, translations } from '../i18n';
import { ShieldCheck, Cpu, Key, Lock, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Building, MapPin, Hash, KeyRound } from 'lucide-react';

interface EGSOnboardingTabProps {
  egsState: EGSState | null;
  onOnboard: (formData: TaxpayerDetails) => Promise<void>;
  isLoading: boolean;
  lang: Language;
}

export const EGSOnboardingTab: React.FC<EGSOnboardingTabProps> = ({
  egsState,
  onOnboard,
  isLoading,
  lang,
}) => {
  const t = translations[lang];

  const [taxpayerName, setTaxpayerName] = useState(
    egsState?.taxpayer?.taxpayerName || 'Al-Noor Retail & Trade LLC'
  );
  const [vatNumber, setVatNumber] = useState(
    egsState?.taxpayer?.vatNumber || '300012345600003'
  );
  const [branchName, setBranchName] = useState(
    egsState?.taxpayer?.branchName || 'Riyadh Main Branch'
  );
  const [city, setCity] = useState(egsState?.taxpayer?.city || 'Riyadh');
  const [otp, setOtp] = useState(egsState?.taxpayer?.otp || '123456');

  const [crNumber, setCrNumber] = useState(egsState?.taxpayer?.crNumber || '1010987654');
  const [streetName, setStreetName] = useState(egsState?.taxpayer?.streetName || 'King Fahd Road');
  const [buildingNumber, setBuildingNumber] = useState(egsState?.taxpayer?.buildingNumber || '4210');
  const [postalCode, setPostalCode] = useState(egsState?.taxpayer?.postalCode || '12211');
  const [district, setDistrict] = useState(egsState?.taxpayer?.district || 'Olaya District');

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isVatValid = /^3\d{13}3$/.test(vatNumber.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!taxpayerName.trim()) {
      setFormError('Taxpayer Name is required.');
      return;
    }
    if (!isVatValid) {
      setFormError('VAT Number must be exactly 15 digits, starting with 3 and ending with 3 (e.g. 300012345600003).');
      return;
    }
    if (!branchName.trim()) {
      setFormError('Branch Name is required.');
      return;
    }
    if (!city.trim()) {
      setFormError('City is required.');
      return;
    }
    if (!otp.trim()) {
      setFormError('OTP from Fatoora Portal is required.');
      return;
    }

    try {
      await onOnboard({
        taxpayerName: taxpayerName.trim(),
        vatNumber: vatNumber.trim(),
        branchName: branchName.trim(),
        city: city.trim(),
        otp: otp.trim(),
        crNumber: crNumber.trim(),
        streetName: streetName.trim(),
        buildingNumber: buildingNumber.trim(),
        postalCode: postalCode.trim(),
        district: district.trim(),
      });
      setSuccessMsg('EGS Device onboarded successfully! Cryptographic Stamp Identifiers (CSID) issued.');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to onboard EGS device.');
    }
  };

  const handleFillSample = () => {
    setTaxpayerName('Al-Noor Retail & Trade LLC');
    setVatNumber('300012345600003');
    setBranchName('Riyadh Main Branch - Olaya');
    setCity('Riyadh');
    setOtp('123456');
    setCrNumber('1010987654');
    setStreetName('King Fahd Road');
    setBuildingNumber('4210');
    setPostalCode('12211');
    setDistrict('Olaya District');
    setFormError(null);
  };

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">{t.onboardingTitle}</h2>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">{t.onboardingDesc}</p>
          </div>

          <button
            type="button"
            onClick={handleFillSample}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 px-3 py-2 rounded-lg text-xs font-medium transition"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{t.fillSampleData}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Onboarding Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              {t.taxpayerFields}
            </h3>
            <span className="text-xs text-slate-500 font-mono">{t.requiredFields}</span>
          </div>

          {formError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error / خطأ</p>
                <p className="mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm p-4 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">CSID Certificate Issued</p>
                <p className="mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Taxpayer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t.taxpayerName} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={taxpayerName}
                onChange={(e) => setTaxpayerName(e.target.value)}
                placeholder="e.g. Al-Noor Retail & Trade LLC"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-600 font-medium"
              />
            </div>

            {/* 15-digit VAT Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t.vatNumber} <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-xs font-mono font-medium ${
                    isVatValid ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {isVatValid ? t.validVatFormat : t.invalidVatFormat}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  maxLength={15}
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="300012345600003"
                  className={`w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm font-mono tracking-wider ${
                    isVatValid
                      ? 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/50'
                      : 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/50'
                  } text-slate-900 focus:bg-white focus:outline-none focus:ring-2`}
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-3 rtl:left-3 rtl:right-auto top-3" />
              </div>
            </div>

            {/* Branch Name & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.branchName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Riyadh Main Branch"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.city} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Riyadh"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-600"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3 rtl:left-3 rtl:right-auto top-3" />
                </div>
              </div>
            </div>

            {/* OTP Input Box */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  {t.fatooraOtp} <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-amber-700 font-medium">{t.otpFromPortal}</span>
              </div>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 bg-white border border-amber-300 rounded-lg text-lg font-mono font-bold tracking-widest text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-600 shadow-inner"
              />
            </div>

            {/* Address & CR Info */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {t.additionalAddress}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.crNumber}</label>
                  <input
                    type="text"
                    value={crNumber}
                    onChange={(e) => setCrNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.streetName}</label>
                  <input
                    type="text"
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.buildingNumber}</label>
                  <input
                    type="text"
                    value={buildingNumber}
                    onChange={(e) => setBuildingNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.postalCode}</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Onboard Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.onboardingInProgress}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{t.onboardButton}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* CSID Certificate & EGS Status Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md p-6 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">{t.certTitle}</h3>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  egsState?.isOnboarded
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                    : 'bg-amber-950 text-amber-300 border-amber-700/60'
                }`}
              >
                {egsState?.isOnboarded ? t.activeCsid : t.csidPending}
              </span>
            </div>

            {/* EGS UUID & Environment */}
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block uppercase tracking-wider">{t.egsUuid}</span>
                <p className="text-sm font-mono text-emerald-300 font-bold bg-slate-950 px-3 py-1.5 rounded border border-slate-800 mt-1">
                  {egsState?.egsUuid || 'EGS-SA-PENDING'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-400 block">{t.zatcaEnv}</span>
                  <span className="text-xs font-medium text-slate-200 bg-slate-800 px-2.5 py-1 rounded mt-1 inline-block border border-slate-700">
                    {egsState?.certificate?.environment || 'Simulation'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">{t.cryptoAlgo}</span>
                  <span className="text-xs font-mono text-slate-200 bg-slate-800 px-2.5 py-1 rounded mt-1 inline-block border border-slate-700">
                    ECDSA secp256r1
                  </span>
                </div>
              </div>
            </div>

            {/* Certificate Details */}
            {egsState?.certificate ? (
              <div className="space-y-4 pt-4 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">{t.csidSerial}</span>
                  <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                    {egsState.certificate.serialNumber}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">{t.complianceCsidToken}</span>
                  <p className="font-mono text-emerald-400 truncate bg-slate-950 p-2 rounded border border-slate-800">
                    {egsState.certificate.complianceCSID}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">{t.productionCsidToken}</span>
                  <p className="font-mono text-emerald-400 truncate bg-slate-950 p-2 rounded border border-slate-800">
                    {egsState.certificate.productionCSID}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">{t.binarySecurityToken}</span>
                  <div className="font-mono text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 max-h-20 overflow-y-auto break-all">
                    {egsState.certificate.binarySecurityToken}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 p-6 rounded-lg border border-slate-800 text-center space-y-2">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">{t.noCertActive}</p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
