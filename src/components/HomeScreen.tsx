import { CHARACTERS, type CharacterId } from '../config/game';
import type { AssetKey, AssetMap } from '../config/assets';

interface HomeScreenProps {
  assets: AssetMap;
  selected: CharacterId;
  t: (key: string, values?: Record<string, string | number>) => string;
  onSelect: (character: CharacterId) => void;
  onStart: () => void;
  onGallery: () => void;
}

export function HomeScreen({
  assets,
  selected,
  t,
  onSelect,
  onStart,
  onGallery,
}: HomeScreenProps) {
  return (
    <main
      className="home-screen"
      style={{ backgroundImage: `url(${assets.bg_home_classroom})` }}
    >
      <section className="home-board">
        <header className="home-heading">
          <h1>{t('app.title')}</h1>
          <h2>{t('home.choose')}</h2>
          <p>{t('home.instructions')}</p>
        </header>

        <div className="character-grid">
          {CHARACTERS.map((character) => {
            const isSelected = selected === character;
            const imageKey = `sym_${character}_select` as AssetKey;
            return (
              <button
                key={character}
                className={`character-card character-card--${character}${isSelected ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(character)}
              >
                <img className="paper-layer" src={assets.panel_character_paper} alt="" draggable={false} />
                <span className="character-portrait">
                  <img src={assets[imageKey]} alt="" draggable={false} />
                </span>
                <strong>{t(`character.${character}.name`)}</strong>
              </button>
            );
          })}
        </div>

        <div className="home-actions">
          <button className="primary-button start-button" type="button" onClick={onStart}>
            {t('home.start')}
          </button>
          <button className="secondary-button" type="button" onClick={onGallery}>
            {t('home.gallery')}
          </button>
        </div>
      </section>
    </main>
  );
}
