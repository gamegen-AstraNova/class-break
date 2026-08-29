import type { AssetKey, AssetMap } from '../config/assets';
import type { GameOutcome } from './GameScreen';

interface ResultScreenProps {
  assets: AssetMap;
  outcome: GameOutcome;
  t: (key: string, values?: Record<string, string | number>) => string;
  onReplay: () => void;
  onHome: () => void;
}

export function ResultScreen({ assets, outcome, t, onReplay, onHome }: ResultScreenProps) {
  const imageKey = `bg_${outcome.character}_${outcome.kind}` as AssetKey;
  return (
    <main className="result-screen">
      <img className="result-cg" src={assets[imageKey]} alt="" draggable={false} />
      <div className="result-shade" />
      <section className="result-card">
        <span className="result-character">{t(`character.${outcome.character}.name`)}</span>
        <h1>{t(`result.${outcome.kind}.title`)}</h1>
        <p>{t(`result.${outcome.kind}.body`)}</p>
        <strong>{t('result.score', { score: outcome.score.toLocaleString() })}</strong>
        <div className="result-actions">
          <button className="primary-button" type="button" onClick={onReplay}>
            {t('result.replay')}
          </button>
          <button className="secondary-button" type="button" onClick={onHome}>
            {t('result.home')}
          </button>
        </div>
      </section>
    </main>
  );
}
