import type { AssetKey, AssetMap } from '../config/assets';
import type { GameOutcome } from './GameScreen';

interface ResultScreenProps {
  assets: AssetMap;
  outcome: GameOutcome;
  t: (key: string, values?: Record<string, string | number>) => string;
  onHome: () => void;
}

export function ResultScreen({ assets, outcome, t, onHome }: ResultScreenProps) {
  const imageKey = `bg_${outcome.character}_${outcome.kind}` as AssetKey;
  return (
    <main
      className="result-screen"
      role="button"
      tabIndex={0}
      aria-label={t('result.home')}
      onClick={onHome}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onHome();
      }}
    >
      <img className="result-cg" src={assets[imageKey]} alt="" draggable={false} />
      <section className="result-summary">
        <span className="result-character">{t(`character.${outcome.character}.name`)}</span>
        <h1>{t(`result.${outcome.kind}.title`)}</h1>
        <p>{t(`result.${outcome.kind}.body`)}</p>
        <strong>{t('result.score', { score: outcome.score.toLocaleString() })}</strong>
      </section>
    </main>
  );
}
