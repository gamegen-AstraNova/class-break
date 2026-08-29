import type { Locale } from '../services/locale';
import { LanguageSelect } from './LanguageSelect';

interface ClassroomControlsProps {
  locale: Locale;
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  t: (key: string) => string;
  onLocaleChange: (locale: Locale) => void;
  onBgmToggle: () => void;
  onSfxToggle: () => void;
}

export function ClassroomControls({
  locale,
  bgmEnabled,
  sfxEnabled,
  t,
  onLocaleChange,
  onBgmToggle,
  onSfxToggle,
}: ClassroomControlsProps) {
  return (
    <aside className="global-tools" aria-label={t('settings.label')}>
      <button
        className={`chalk-toggle${bgmEnabled ? ' is-enabled' : ''}`}
        type="button"
        aria-pressed={bgmEnabled}
        aria-label={`${t('audio.bgm.toggle')} — ${t(bgmEnabled ? 'audio.on' : 'audio.off')}`}
        title={`${t('audio.bgm')} — ${t(bgmEnabled ? 'audio.on' : 'audio.off')}`}
        onClick={onBgmToggle}
      >
        <span className="control-emoji" aria-hidden="true">🎵</span>
      </button>
      <button
        className={`chalk-toggle${sfxEnabled ? ' is-enabled' : ''}`}
        type="button"
        aria-pressed={sfxEnabled}
        aria-label={`${t('audio.sfx.toggle')} — ${t(sfxEnabled ? 'audio.on' : 'audio.off')}`}
        title={`${t('audio.sfx')} — ${t(sfxEnabled ? 'audio.on' : 'audio.off')}`}
        onClick={onSfxToggle}
      >
        <span className="control-emoji" aria-hidden="true">🔊</span>
      </button>
      <LanguageSelect
        locale={locale}
        label={t('language.label')}
        optionLabel={(item) => t(`language.${item}`)}
        onChange={onLocaleChange}
      />
    </aside>
  );
}
