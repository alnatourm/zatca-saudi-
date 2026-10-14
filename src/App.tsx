import { useState, useEffect, useCallback } from 'react';
import { EGSState, TaxpayerDetails, InvoiceRequest, GeneratedInvoiceResponse, DecodedQRResponse, CompanyTenant } from './types';
import { Language } from './i18n';
import { Header } from './components/Header';
import { EGSOnboardingTab } from './components/EGSOnboardingTab';
import { POSSimulatorTab } from './components/POSSimulatorTab';
import { StateInspectorTab } from './components/StateInspectorTab';
import { AdminDashboardTab } from './components/AdminDashboardTab';
import { AuthModal } from './components/AuthModal';
import { QRDecoderModal } from './components/QRDecoderModal';
import { AddTenantModal } from './components/AddTenantModal';
import { ShieldCheck, AlertCircle, Clock, XCircle, LogOut } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('ar'); // Default to Arabic / العربية
  const [activeTab, setActiveTab] = useState<'onboarding' | 'pos' | 'inspector' | 'admin'>('pos');
  const [egsState, setEgsState] = useState<EGSState | null>(null);
  const [invoiceList, setInvoiceList] = useState<GeneratedInvoiceResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth User State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Multi-Tenant SaaS State
  const [tenants, setTenants] = useState<CompanyTenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('saudi-flame-grill');
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState<boolean>(false);

  // QR Decoder Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [qrBase64ToDecode, setQrBase64ToDecode] = useState<string>('');

  // Check current session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        if (data.user.role === 'admin' && activeTab === 'admin') {
          // Keep admin tab
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Failed to check session:', err);
    } finally {
      setIsAuthChecking(false);
    }
  }, [activeTab]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setActiveTab('pos');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Fetch tenants list
  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      if (data.success && data.tenants) {
        setTenants(data.tenants);
        if (data.activeTenantId) {
          setActiveTenantId(data.activeTenantId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tenants list:', err);
    }
  }, []);

  // Fetch initial EGS state
  const fetchEGSStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/egs/status');
      const data = await res.json();
      if (data.success) {
        setEgsState(data.egs);
        if (data.activeTenantId) {
          setActiveTenantId(data.activeTenantId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch EGS state:', err);
    }
  }, []);

  // Fetch invoice history
  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoice/list');
      const data = await res.json();
      if (data.success) {
        setInvoiceList(data.invoices);
      }
    } catch (err) {
      console.error('Failed to fetch invoice list:', err);
    }
  }, []);

  useEffect(() => {
    checkSession();
    fetchTenants();
    fetchEGSStatus();
    fetchInvoices();
  }, [checkSession, fetchTenants, fetchEGSStatus, fetchInvoices]);

  // Switch Active Tenant
  const handleSelectTenant = async (tenantId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tenants/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTenantId(data.activeTenantId);
        setEgsState(data.egs);
        fetchInvoices();
      }
    } catch (err) {
      console.error('Failed to switch tenant:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add New Tenant / Restaurant Handler
  const handleAddTenant = async (tenantData: {
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
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to register new tenant');
      }
      await fetchTenants();
      if (data.activeTenantId) {
        await handleSelectTenant(data.activeTenantId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating tenant');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Onboard handler
  const handleOnboard = async (taxpayer: TaxpayerDetails) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/egs/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taxpayer),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Onboarding failed');
      }
      setEgsState(data.egs);
      fetchTenants();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error during onboarding');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Generate invoice handler
  const handleGenerateInvoice = async (request: InvoiceRequest): Promise<GeneratedInvoiceResponse> => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Invoice generation failed');
      }

      setEgsState(data.updatedEgsState);
      fetchInvoices();
      fetchTenants();
      return data.invoice;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generating invoice');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Reset ICV / State handler
  const handleResetState = async () => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت تأكد من إعادة ضبط عداد الفواتير ومسح السجل؟' : 'Reset Invoice Counter Value (ICV) to 0 and clear invoice history?')) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/egs/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setEgsState(data.egs);
        fetchInvoices();
        fetchTenants();
      }
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Decode QR API handler
  const handleDecodeQR = async (qrBase64: string): Promise<DecodedQRResponse> => {
    const res = await fetch('/api/invoice/decode-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrBase64 }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to decode QR code');
    }
    return data.decoded;
  };

  const handleOpenQRModal = (base64TLV: string = '') => {
    setQrBase64ToDecode(base64TLV || egsState?.pih || '');
    setIsQRModalOpen(true);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
      </div>
    );
  }

  // If user is not logged in, show AuthModal
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <AuthModal
          onSuccess={(user) => {
            setCurrentUser(user);
            checkSession();
          }}
          lang={lang}
        />
      </div>
    );
  }

  // If user is pending approval
  if (currentUser.status === 'pending') {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-100">
              {lang === 'ar' ? 'حسابك قيد المراجعة (Pending Approval)' : 'Account Pending Admin Approval'}
            </h1>
            <p className="text-sm text-slate-400">
              {lang === 'ar'
                ? 'شكراً لتسجيلك في منصة فاتورة. تم إرسال طلبك بنجاح وهو الآن قيد المراجعة والاعتماد من قبل مسؤول النظام. سيتم تفعيل حسابك قريباً.'
                : 'Thank you for registering. Your account has been created and is currently awaiting review and activation by the system administrator.'}
            </p>
          </div>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
            <div>{lang === 'ar' ? 'البريد الإلكتروني:' : 'Email:'} {currentUser.email}</div>
            <div>{lang === 'ar' ? 'الشركة:' : 'Company:'} {currentUser.companyName || 'N/A'}</div>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={checkSession}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
            >
              {lang === 'ar' ? 'التحقق من حالة الحساب' : 'Check Approval Status'}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is blocked
  if (currentUser.status === 'blocked') {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-red-400">
              {lang === 'ar' ? 'تم حظر الحساب (Account Blocked)' : 'Account Has Been Blocked'}
            </h1>
            <p className="text-sm text-slate-400">
              {lang === 'ar'
                ? 'عذراً، تم حظر حسابك أو إيقافه مؤقتاً من قبل مسؤول النظام. يرجى التواصل مع الدعم الفني للاستفسار.'
                : 'Sorry, your account has been blocked or suspended by the system administrator. Please contact support.'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5 mx-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased"
    >
      {/* Header with Multi-Tenant Navigation & Language Switcher */}
      <Header
        egsState={egsState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQRDecoder={() => handleOpenQRModal('')}
        lang={lang}
        setLang={setLang}
        tenants={tenants}
        activeTenantId={activeTenantId}
        onSelectTenant={handleSelectTenant}
        onOpenAddTenantModal={() => setIsAddTenantModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="bg-red-950/80 border-b border-red-800/80 text-red-200 text-xs sm:text-sm px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-white text-xs font-bold"
            >
              {lang === 'ar' ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'onboarding' && (
          <EGSOnboardingTab
            egsState={egsState}
            activeTenant={tenants.find((t) => t.id === activeTenantId) || null}
            onOnboard={handleOnboard}
            isLoading={isLoading}
            lang={lang}
          />
        )}

        {activeTab === 'pos' && (
          <POSSimulatorTab
            egsState={egsState}
            activeTenant={tenants.find((t) => t.id === activeTenantId) || null}
            onGenerateInvoice={handleGenerateInvoice}
            onOpenQRDecoder={handleOpenQRModal}
            isLoading={isLoading}
            lang={lang}
          />
        )}

        {activeTab === 'inspector' && (
          <StateInspectorTab
            egsState={egsState}
            invoiceList={invoiceList}
            onResetState={handleResetState}
            onOpenQRDecoder={handleOpenQRModal}
            isLoading={isLoading}
            lang={lang}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <AdminDashboardTab
            lang={lang}
            onUserStatusUpdated={checkSession}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-300">
              {lang === 'ar'
                ? 'بوابة الفوترة الإلكترونية السعودية (فاتورة) - المرحلة الثانية (نظام متعدد المنشآت)'
                : 'ZATCA Phase 2 E-Invoicing Gateway (Fatoora) - Multi-Tenant SaaS'}
            </span>
            <span className="text-slate-600">|</span>
            <span>{lang === 'ar' ? 'هيئة الزكاة والضريبة والجمارك' : 'Saudi Arabia Tax Authority Standard'}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>UBL 2.1 Schema</span>
            <span>•</span>
            <span>ECDSA secp256r1</span>
            <span>•</span>
            <span>Base64 TLV Tag 1..9</span>
          </div>
        </div>
      </footer>

      {/* Add New Tenant Modal */}
      <AddTenantModal
        isOpen={isAddTenantModalOpen}
        onClose={() => setIsAddTenantModalOpen(false)}
        onAddTenant={handleAddTenant}
        lang={lang}
      />

      {/* QR Decoder Inspector Modal */}
      <QRDecoderModal
        isOpen={isQRModalOpen}
        initialBase64={qrBase64ToDecode}
        onClose={() => setIsQRModalOpen(false)}
        onDecode={handleDecodeQR}
        lang={lang}
      />
    </div>
  );
}
