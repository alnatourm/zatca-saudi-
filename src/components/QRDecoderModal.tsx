import React, { useState, useEffect } from 'react';
import { DecodedQRResponse } from '../types';
import { Language, translations } from '../i18n';
import { X, QrCode, ShieldCheck, Copy, Check, Search } from 'lucide-react';

interface QRDecoderModalProps {
  isOpen: boolean;
  initialBase64: string;
  onClose: () => void;
  onDecode: (qrBase64: string) => Promise<DecodedQRResponse>;
  lang: Language;
}

export const QRDecoderModal: React.FC<QRDecoderModalProps> = ({
  isOpen,
  initialBase64,
  onClose,
  onDecode,
  lang,
}) => {
  const t = translations[lang];
  const [inputBase64, setInputBase64] = useState(initialBase64);
  const [decodedData, setDecodedData] = useState<DecodedQRResponse | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialBase64) {
      setInputBase64(initialBase64);
      triggerDecode(initialBase64);
    }
  }, [initialBase64]);

  const triggerDecode = async (str: string) => {
    if (!str.trim()) return;
    setIsDecoding(true);
    try {
      const res = await onDecode(str.trim());
      setDecodedData(res);
    } catch {
      setDecodedData(null);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(inputBase64);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t.qrModalTitle}</h3>
              <p className="text-xs text-slate-400">{t.qrModalDesc}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Base64 Input Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t.rawBase64Label}
              </label>
              <button
                onClick={handleCopyRaw}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy String'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <textarea
                rows={3}
                value={inputBase64}
                onChange={(e) => setInputBase64(e.target.value)}
                placeholder="Paste ZATCA Phase 2 Base64 TLV string here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={() => triggerDecode(inputBase64)}
              disabled={isDecoding || !inputBase64.trim()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{isDecoding ? t.decodingProgress : t.decodeButton}</span>
            </button>
          </div>

          {/* Decoded Output */}
          {decodedData && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {t.extractedTags} ({decodedData.tags.length} Tags)
                </span>

                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                    decodedData.isValidZATCA
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                      : 'bg-red-950 text-red-300 border-red-700/60'
                  }`}
                >
                  {decodedData.isValidZATCA ? t.validTlvFormat : 'INVALID / INCOMPLETE TLV'}
                </span>
              </div>

              {/* Tag Cards List */}
              <div className="space-y-3">
                {decodedData.tags.map((tag) => (
                  <div
                    key={tag.tag}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center justify-center text-xs font-mono font-bold">
                          {tag.tag}
                        </span>
                        <h4 className="text-sm font-bold text-white">{tag.name}</h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Len: {tag.length} bytes
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-400">{tag.description}</p>
                      <p className="text-xs font-mono font-semibold text-emerald-300 bg-slate-900 p-2 rounded border border-slate-800 break-all">
                        {tag.value}
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-slate-500 pt-1 flex items-center gap-2">
                      <span>Hex Bytes:</span>
                      <span className="text-slate-400 truncate">{tag.hexValue}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            {t.closeModal}
          </button>
        </div>

      </div>
    </div>
  );
};
