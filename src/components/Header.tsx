import React from 'react';
import { EGSState } from '../types';
import { Language, translations } from '../i18n';
import { ShieldCheck, ShieldAlert, FileCode2, QrCode, Cpu, Hash, Building2, Languages } from 'lucide-react';

interface HeaderProps {
  egsState: EGSState | null;
  activeTab: 'onboarding' | 'pos' | 'inspector';
  setActiveTab: (tab: 'onboarding' | 'pos' | 'inspector') => void;
  onOpenQRDecoder: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  egsState,
  activeTab,
  setActiveTab,
  onOpenQRDecoder,
  lang,
  setLang,
}) => {
  const t = translations[lang];
  const isOnboarded = egsState?.isOnboarded ?? false;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand & Title */}
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-11 h-11 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className="bg-emerald-900/80 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded border border-emerald-700/50">
                  ZATCA Phase 2
                </span>
                <span className="text-slate-400 text-xs font-mono">{t.appSubTitle}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                {t.appTitle}
                <span className="text-emerald-400 text-xs font-normal font-sans bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  {t.ublStandard}
                </span>
              </h1>
            </div>
          </div>

          {/* Quick Info Pills & Language Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Language Switcher Button */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 text-xs font-bold px-3 py-1.5 rounded-md border border-emerald-700/60 transition shadow-sm"
              title="Switch Language / تغيير اللغة"
            >
              <Languages className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {/* EGS Onboarding Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border ${
                isOnboarded
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-700/60 text-amber-300'
              }`}
            >
              {isOnboarded ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t.egsOnboarded}</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>{t.csidPending}</span>
                </>
              )}
            </div>

            {/* ICV Counter */}
            {egsState && (
              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-md text-xs border border-slate-700 text-slate-300">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>ICV:</span>
                <span className="font-mono font-bold text-white">{egsState.icv}</span>
              </div>
            )}

            {/* Taxpayer VAT snippet */}
            {egsState?.taxpayer?.vatNumber && (
              <div className="hidden lg:flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-md text-xs border border-slate-700 text-slate-300">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono">{egsState.taxpayer.vatNumber}</span>
              </div>
            )}

            {/* Decode QR tool button */}
            <button
              onClick={onOpenQRDecoder}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-md border border-slate-700 transition"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.decodeQR}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-4 rtl:space-x-reverse overflow-x-auto py-2">
            
            {/* Tab 1: EGS Onboarding */}
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                activeTab === 'onboarding'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>{t.tabOnboarding}</span>
              {!isOnboarded && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </button>

            {/* Tab 2: POS Invoice Simulator */}
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              <span>{t.tabPos}</span>
            </button>

            {/* Tab 3: State Inspector */}
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                activeTab === 'inspector'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Hash className="w-4 h-4" />
              <span>{t.tabInspector}</span>
              {egsState && egsState.icv > 0 && (
                <span className="bg-emerald-950 text-emerald-300 text-xs px-1.5 py-0.2 rounded-full border border-emerald-800/60 font-mono">
                  {egsState.icv}
                </span>
              )}
            </button>

          </nav>
        </div>
      </div>
    </header>
  );
};
