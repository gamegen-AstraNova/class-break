import { LOCALES, type Locale } from '../services/locale';

interface LanguageSelectProps {
  locale: Locale;
  label: string;
  optionLabel: (locale: Locale) => string;
  onChange: (locale: Locale) => void;
}

export function LanguageSelect({ locale, label, optionLabel, onChange }: LanguageSelectProps) {
  return (
    <label className="language-select" title={`${label} — ${optionLabel(locale)}`}>
      <span className="sr-only">{label}</span>
      <span className="language-emoji" aria-hidden="true">🌐</span>
      <select
        value={locale}
        aria-label={`${label} — ${optionLabel(locale)}`}
        onChange={(event) => onChange(event.target.value as Locale)}
      >
        {LOCALES.map((item) => (
          <option key={item} value={item}>
            {optionLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
