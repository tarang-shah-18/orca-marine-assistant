import React from 'react';
import { X, Check, Globe } from 'lucide-react';
import { LanguageOption, SUPPORTED_LANGUAGES } from '../types';
import { getPhrasebook } from '../core/i18n';

interface LanguageModalProps {
  currentLanguage: LanguageOption;
  onSelectLanguage: (lang: LanguageOption) => void;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({
  currentLanguage,
  onSelectLanguage,
  onClose,
}) => {
  const ui = getPhrasebook(currentLanguage.code).ui;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 text-slate-100 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-50">{ui.selectLanguageWord}</h2>
              <p className="text-xs text-slate-400">भाषा निवडा / भाषा चुनें / భాషను ఎంచుకోండి</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLanguage.code === lang.code;

            return (
              <button
                key={lang.code}
                onClick={() => {
                  onSelectLanguage(lang);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/50 border-cyan-500 text-slate-50 shadow-md'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center font-bold text-cyan-400 text-sm border border-slate-700">
                    {lang.code.split('-')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-base">{lang.nativeLabel}</div>
                    <div className="text-xs text-slate-400">
                      {lang.label} • <span className="text-slate-500">{lang.region}</span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-2 text-center text-xs text-slate-400">
          Voice input (Speech-to-Text) and audio readout (TTS) will automatically adapt to this selection.
        </div>
      </div>
    </div>
  );
};
