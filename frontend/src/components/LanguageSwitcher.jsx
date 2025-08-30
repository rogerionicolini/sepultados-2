
import React from 'react';
import i18n from '../i18n';

const langs = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
];

export default function LanguageSwitcher({ className = '' }) {
  const current = i18n.language;
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {langs.map(l => (
          <button
            key={l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className={"px-2 py-1 rounded-md text-xs border " + (current.startsWith(l.code) ? "bg-emerald-100 border-emerald-300" : "border-gray-300 hover:bg-gray-100")}
            title={l.label}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
