import React, { useState, useEffect } from 'react';
import { EGSState, TaxpayerDetails, CompanyTenant } from '../types';
import { Language, translations } from '../i18n';
import { ShieldCheck, Cpu, Key, Lock, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Building, MapPin, Hash, KeyRound, AlertTriangle } from 'lucide-react';

interface EGSOnboardingTabProps {
  egsState: EGSState | null;
  activeTenant?: CompanyTenant | null;
  onOnboard: (formData: TaxpayerDetails) => Promise<void>;
  isLoading: boolean;
  lang: Language;
}

export const EGSOnboardingTab: React.FC<EGSOnboardingTabProps> = ({
  egsState,
  activeTenant,
  onOnboard,
  isLoading,
  lang,
}) => {
  const t = translations[lang];

  const [taxpayerName, setTaxpayerName] = useState(
    activeTenant?.name || egsState?.taxpayer?.taxpayerName || 'Saudi Flame Grill'
  );
  const [vatNumber, setVatNumber] = useState(
    activeTenant?.vatNumber || egsState?.taxpayer?.vatNumber || '300049785700003'
  );
  const [branchName, setBranchName] = useState(
    activeTenant?.branchName || egsState?.taxpayer?.branchName || 'Riyadh Main Branch'
  );
  const [city, setCity] = useState(
    activeTenant?.city || egsState?.taxpayer?.city || 'Riyadh'
  );
  const [otp, setOtp] = useState(egsState?.taxpayer?.otp || '123456');

  const [crNumber, setCrNumber] = useState(
    activeTenant?.crNumber || egsState?.taxpayer?.crNumber || '1010884422'
  );
  const [streetName, setStreetName] = useState(
    activeTenant?.streetName || egsState?.taxpayer?.streetName || 'King Fahd Road'
  );
  const [buildingNumber, setBuildingNumber] = useState(
    activeTenant?.buildingNumber || egsState?.taxpayer?.buildingNumber || '2145'
  );
  const [postalCode, setPostalCode] = useState(
    activeTenant?.postalCode || egsState?.taxpayer?.postalCode || '12211'
  );
  const [district, setDistrict] = useState(
    activeTenant?.district || egsState?.taxpayer?.district || 'Olaya'
  );

  const [generatedCsrBase64, setGeneratedCsrBase64] = useState<string>(activeTenant?.cleanCsrBase64 || '');
  const [formError, setFormError] = useState<{ title: string; code?: string; message: string; raw?: any } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [complianceStatusMsg, setComplianceStatusMsg] = useState<string | null>(null);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);

  // Sync state when activeTenant changes
  useEffect(() => {
    if (activeTenant) {
      setTaxpayerName(activeTenant.name);
      setVatNumber(activeTenant.vatNumber);
      setBranchName(activeTenant.branchName);
      setCity(activeTenant.city);
      if (activeTenant.crNumber) setCrNumber(activeTenant.crNumber);
      if (activeTenant.streetName) setStreetName(activeTenant.streetName);
      if (activeTenant.buildingNumber) setBuildingNumber(activeTenant.buildingNumber);
      if (activeTenant.postalCode) setPostalCode(activeTenant.postalCode);
      if (activeTenant.district) setDistrict(activeTenant.district);
      if (activeTenant.cleanCsrBase64) setGeneratedCsrBase64(activeTenant.cleanCsrBase64);
    }
  }, [activeTenant?.id, activeTenant?.cleanCsrBase64]);

  const isVatValid = /^3\d{13}3$/.test(vatNumber.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);
    setComplianceStatusMsg(null);

    if (!taxpayerName.trim()) {
      setFormError({ title: 'Validation Error', message: 'Taxpayer Name is required.' });
      return;
    }
    if (!isVatValid) {
      setFormError({
        title: 'Validation Error',
        message: 'VAT Number must be exactly 15 digits, starting with 3 and ending with 3 (e.g. 300049785700003).',
      });
      return;
    }
    if (!branchName.trim()) {
      setFormError({ title: 'Validation Error', message: 'Branch Name is required.' });
      return;
    }
    if (!city.trim()) {
      setFormError({ title: 'Validation Error', message: 'City is required.' });
      return;
    }
    if (!otp.trim()) {
      setFormError({ title: 'Validation Error', message: 'OTP from Fatoora Portal is required.' });
      return;
    }

    setIsLocalSubmitting(true);

    try {
      let currentCsr = generatedCsrBase64 || activeTenant?.cleanCsrBase64 || '';

      // Step A: Generate PKCS#10 CSR if not generated yet
      if (!currentCsr) {
        const csrRes = await fetch('/api/zatca/onboard/generate-csr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: activeTenant?.id,
            vatNumber: vatNumber.trim(),
            companyName: taxpayerName.trim(),
            branchName: branchName.trim(),
            city: city.trim(),
            environment: activeTenant?.environment || 'simulation',
          }),
        });

        const csrData = await csrRes.json();
        if (!csrRes.ok || !csrData.csrBase64) {
          throw new Error(csrData.error || 'Failed to generate PKCS#10 CSR for EGS unit.');
        }
        currentCsr = csrData.csrBase64;
        setGeneratedCsrBase64(currentCsr);
      }

      // Step B: Exchange OTP directly with ZATCA Gateway
      const otpRes = await fetch('/api/zatca/onboard/exchange-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant?.id,
          otp: otp.trim(),
          csrBase64: currentCsr,
          environment: activeTenant?.environment || 'simulation',
        }),
      });

      const otpData = await otpRes.json();

      if (!otpRes.ok || !otpData.credentials?.binarySecurityToken) {
        setFormError({
          title: lang === 'ar' ? 'فشل التحقق من هيئة الزكاة (ZATCA Verification Failed)' : 'ZATCA Verification Failed',
          code: otpData.zatcaErrorCode || `HTTP-${otpRes.status}`,
          message: otpData.error || otpData.message || 'The OTP provided is invalid, expired, or unverified by ZATCA.',
          raw: otpData,
        });
        setIsLocalSubmitting(false);
        return;
      }

      // Sync state with parent handler
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

      setSuccessMsg(
        lang === 'ar'
          ? 'تم التحقق بنجاح من هيئة الزكاة وإصدار شهادة Compliance CSID!'
          : 'ZATCA Verification Succeeded! Compliance CSID Certificate issued.'
      );

      // Step C: Automated 4-Document Compliance Test Suite
      setComplianceStatusMsg(lang === 'ar' ? 'جاري تشغيل فحص الالتزام التلقائي (4 مستندات)...' : 'Running automated 4-document compliance test battery...');

      const compRes = await fetch('/api/zatca/onboard/run-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: activeTenant?.id }),
      });
      const compData = await compRes.json();

      if (compData.status === 'COMPLIANCE_TESTS_COMPLETED') {
        // Step D: Upgrade to Production CSID
        setComplianceStatusMsg(lang === 'ar' ? 'تم اجتياز الفحص! جاري ترقية الشهادة إلى Production CSID...' : 'Compliance tests passed! Upgrading to Production CSID...');
        const prodRes = await fetch('/api/zatca/onboard/upgrade-production', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: activeTenant?.id }),
        });
        const prodData = await prodRes.json();

        if (prodData.status === 'PRODUCTION_READY') {
          setComplianceStatusMsg(
            lang === 'ar'
              ? 'تهانينا! تم إصدار شهادة الإنتاج الرسمية (Production CSID Active). وحدة EGS جاهزة للعمل الحي!'
              : 'Production CSID Active! EGS Solution Unit is authorized for live clearance & reporting.'
          );
        }
      }
    } catch (err: any) {
      setFormError({
        title: lang === 'ar' ? 'فشل التحقق من هيئة الزكاة (ZATCA Verification Failed)' : 'ZATCA Verification Failed',
        message: err.message || 'Connection or verification error during ZATCA onboarding.',
      });
    } finally {
      setIsLocalSubmitting(false);
    }
  };

  const handleFillSample = () => {
    setTaxpayerName('Saudi Flame Grill');
    setVatNumber('300049785700003');
    setBranchName('Riyadh Main Branch');
    setCity('Riyadh');
    setOtp('123456');
    setCrNumber('1010884422');
    setStreetName('King Fahd Road');
    setBuildingNumber('2145');
    setPostalCode('12211');
    setDistrict('Olaya');
    setFormError(null);
  };

  const isSubmitting = isLoading || isLocalSubmitting;
  const currentStatus = activeTenant?.csidStatus || 'NOT_ONBOARDED';

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

          {/* Strict Gateway Error Banner */}
          {formError && (
            <div className="mb-6 bg-red-50/90 border border-red-300 text-red-900 text-xs sm:text-sm p-4 rounded-xl space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{formError.title}</span>
              </div>
              {formError.code && (
                <div className="bg-red-100 border border-red-200 text-red-800 px-2.5 py-1 rounded font-mono text-xs w-fit">
                  Error Code: <strong>{formError.code}</strong>
                </div>
              )}
              <p className="text-slate-800 text-xs leading-relaxed font-mono break-all">{formError.message}</p>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && !formError && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              {complianceStatusMsg && (
                <p className="text-xs text-emerald-700 font-medium bg-emerald-100/60 p-2 rounded border border-emerald-200">
                  ⚡ {complianceStatusMsg}
                </p>
              )}
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
                placeholder="Saudi Flame Grill"
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
                  placeholder="300049785700003"
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
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.onboardingInProgress}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{lang === 'ar' ? 'تهيئة وحدة EGS وطلب شهادة CSID' : 'Onboard EGS & Request CSID'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* CSID Certificate & Multi-Tenant Security Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md p-6 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">{t.certTitle}</h3>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  currentStatus === 'PRODUCTION_ACTIVE'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : currentStatus === 'CCSID_ACTIVE' || currentStatus === 'COMPLIANCE_ACTIVE'
                    ? 'bg-blue-950 text-blue-300 border-blue-700/60'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {currentStatus === 'PRODUCTION_ACTIVE'
                  ? 'PRODUCTION CSID ACTIVE'
                  : currentStatus === 'CCSID_ACTIVE' || currentStatus === 'COMPLIANCE_ACTIVE'
                  ? 'COMPLIANCE CSID ISSUED'
                  : lang === 'ar' ? 'شهادة معلقة' : 'NOT ONBOARDED'}
              </span>
            </div>

            {/* Dynamic Tenant Info */}
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block uppercase tracking-wider">{t.egsUuid}</span>
                <p className="text-sm font-mono text-emerald-300 font-bold bg-slate-950 px-3 py-1.5 rounded border border-slate-800 mt-1">
                  {activeTenant?.egsUuid || egsState?.egsUuid || 'EGS-SA-PENDING'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-400 block">{t.zatcaEnv}</span>
                  <span className="text-xs font-medium text-slate-200 bg-slate-800 px-2.5 py-1 rounded mt-1 inline-block border border-slate-700">
                    {activeTenant?.environment ? (activeTenant.environment === 'production' ? 'Production' : 'Simulation') : 'Simulation'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">{t.cryptoAlgo}</span>
                  <span className="text-xs font-mono text-emerald-400 bg-slate-800 px-2.5 py-1 rounded mt-1 inline-block border border-slate-700">
                    ECDSA secp256k1
                  </span>
                </div>
              </div>
            </div>

            {/* Certificate Tokens & Serial */}
            {activeTenant?.binarySecurityToken && currentStatus !== 'NOT_ONBOARDED' ? (
              <div className="space-y-4 pt-4 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">{t.csidSerial}</span>
                  <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                    {`SN-ZATCA-${(activeTenant?.id || 'DEFAULT').toUpperCase()}-001`}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">{t.complianceCsidToken}</span>
                  <p className="font-mono text-emerald-400 truncate bg-slate-950 p-2 rounded border border-slate-800">
                    {activeTenant?.complianceRequestId || 'CCSID-ACTIVE-REQUEST-ID'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">{t.binarySecurityToken}</span>
                  <div className="font-mono text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 max-h-20 overflow-y-auto break-all">
                    {activeTenant.binarySecurityToken}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 p-6 rounded-lg border border-slate-800 text-center space-y-2">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">
                  {lang === 'ar' ? 'لم يتم إصدار شهادة CSID لهذه المنشأة بعد' : t.noCertActive}
                </p>
              </div>
            )}

          </div>

          {/* Phase 2 Go-Live Production Runbook Panel */}
          <div className="bg-slate-900 text-white rounded-xl border border-amber-500/40 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'دليل الانطلاق للإنتاج الفعلي (Go-Live Runbook)' : 'Phase 2 Go-Live Runbook'}
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded">
                PROD CORE
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'خطوات الربط المباشر مع منصة فاتورة الإنتاجية لبيئة الأعمال (Production Gateway):'
                : 'Sequence for transitioning solution units to ZATCA Production Gateway:'}
            </p>

            <div className="space-y-3 text-xs">
              {/* Step 1 */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-amber-400">1. {lang === 'ar' ? 'توليد مفاتيح وشهادة CSR للإنتاج' : 'Generate Production CSR'}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Template: <code className="text-emerald-400">ZATCA-Code-Signing</code></p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setSuccessMsg(null); setFormError(null);
                    try {
                      const res = await fetch('/api/zatca/onboard/generate-csr', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tenantId: activeTenant?.id,
                          environment: 'production',
                          vatNumber: vatNumber.trim(),
                          companyName: taxpayerName.trim(),
                          branchName: branchName.trim(),
                          city: city.trim(),
                        }),
                      });
                      const d = await res.json();
                      if (res.ok && d.status === 'CSR_GENERATED' && d.csrBase64) {
                        setGeneratedCsrBase64(d.csrBase64);
                        setSuccessMsg(lang === 'ar' ? 'تم توليد ملف CSR للإنتاج بنجاح' : 'Production CSR generated successfully');
                      } else {
                        setFormError({ title: 'CSR Error', message: d.error || 'Failed to generate CSR' });
                      }
                    } catch (e: any) { setFormError({ title: 'CSR Error', message: e.message }); }
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px] shrink-0"
                >
                  {lang === 'ar' ? 'توليد CSR' : 'Run CSR'}
                </button>
              </div>

              {/* Step 2 */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-amber-400">2. {lang === 'ar' ? 'تبادل رمز OTP للحصول على Compliance CSID' : 'Exchange Live OTP'}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Target: <code className="text-slate-300">gw-fatoora.zatca.gov.sa/e-invoicing/core</code></p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setSuccessMsg(null); setFormError(null);
                    try {
                      const csrToUse = generatedCsrBase64 || activeTenant?.cleanCsrBase64 || '';
                      const res = await fetch('/api/zatca/onboard/exchange-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tenantId: activeTenant?.id,
                          otp: otp.trim(),
                          csrBase64: csrToUse,
                          environment: 'production',
                        }),
                      });
                      const d = await res.json();
                      if (res.ok && d.credentials?.binarySecurityToken) {
                        setSuccessMsg(lang === 'ar' ? 'تم استلام شهادة Compliance CSID بنجاح' : 'Compliance CSID Issued');
                      } else {
                        setFormError({
                          title: lang === 'ar' ? 'فشل التحقق من هيئة الزكاة (ZATCA Verification Failed)' : 'ZATCA Verification Failed',
                          code: d.zatcaErrorCode || `HTTP-${res.status}`,
                          message: d.error || d.message || 'OTP Exchange failed',
                          raw: d,
                        });
                      }
                    } catch (e: any) { setFormError({ title: 'OTP Exchange Error', message: e.message }); }
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] shrink-0"
                >
                  {lang === 'ar' ? 'تبادل OTP' : 'Run OTP'}
                </button>
              </div>

              {/* Step 3 */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-amber-400">3. {lang === 'ar' ? 'تنفيذ فحص الالتزام (4 المستندات)' : 'Run 4-Doc Compliance Battery'}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Submits 0200000 / 0100000 sample invoices & notes</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setSuccessMsg(null); setFormError(null);
                    try {
                      const res = await fetch('/api/zatca/onboard/run-compliance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tenantId: activeTenant?.id, vatNumber, companyName: taxpayerName })
                      });
                      const d = await res.json();
                      if (res.ok && d.status === 'COMPLIANCE_TESTS_COMPLETED') {
                        setSuccessMsg(lang === 'ar' ? 'اجتازت جميع المستندات الـ 4 فحص الالتزام بنجاح!' : 'All 4 compliance documents passed validation!');
                      } else {
                        setFormError({ title: 'Compliance Error', message: d.error || 'Compliance checks failed' });
                      }
                    } catch (e: any) { setFormError({ title: 'Compliance Error', message: e.message }); }
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[11px] shrink-0"
                >
                  {lang === 'ar' ? 'تشغيل الفحص' : 'Run Suite'}
                </button>
              </div>

              {/* Step 4 */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-emerald-400">4. {lang === 'ar' ? 'إصدار شهادة الإنتاج الرسمية (Production CSID)' : 'Issue Production CSID (PCSID)'}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Authorizes unit for commercial clearance & reporting (1 year validity)</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setSuccessMsg(null); setFormError(null);
                    try {
                      const res = await fetch('/api/zatca/onboard/upgrade-production', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tenantId: activeTenant?.id, environment: 'production' })
                      });
                      const d = await res.json();
                      if (res.ok && d.status === 'PRODUCTION_READY') {
                        setSuccessMsg(lang === 'ar' ? 'تهانينا! تم إصدار شهادة الإنتاج PCSID بنجاح والنظام جاهز لإصدار الفواتير الحية' : 'Production CSID issued successfully!');
                      } else {
                        setFormError({ title: 'PCSID Upgrade Error', message: d.error || 'PCSID upgrade failed' });
                      }
                    } catch (e: any) { setFormError({ title: 'PCSID Upgrade Error', message: e.message }); }
                  }}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-[11px] shrink-0"
                >
                  {lang === 'ar' ? 'إصدار PCSID' : 'Upgrade PCSID'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
