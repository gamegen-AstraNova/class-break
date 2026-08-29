import { useEffect, useRef, useState } from 'react';
import type { AssetKey, AssetMap } from '../config/assets';
import { CHARACTERS, type CharacterId } from '../config/game';
import { RESULT_KINDS, type ResultKind } from '../game/logic';

interface SelectedCg {
  character: CharacterId;
  result: ResultKind;
}

interface GalleryScreenProps {
  assets: AssetMap;
  unlocked: Set<string>;
  t: (key: string, values?: Record<string, string | number>) => string;
  onBack: () => void;
}

export function GalleryScreen({ assets, unlocked, t, onBack }: GalleryScreenProps) {
  const [selectedCg, setSelectedCg] = useState<SelectedCg | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const closeLightbox = () => {
    setSelectedCg(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!selectedCg) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
    };

    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCg]);

  const selectedImageKey = selectedCg
    ? (`bg_${selectedCg.character}_${selectedCg.result}` as AssetKey)
    : null;
  const selectedLabel = selectedCg
    ? t('gallery.view', {
        character: t(`character.${selectedCg.character}.name`),
        result: t(`gallery.${selectedCg.result}`),
      })
    : '';

  return (
    <main className="gallery-screen">
      <header className="gallery-header">
        <div>
          <span className="lesson-chip">{t('app.title')}</span>
          <h1>{t('gallery.title')}</h1>
          <p>{t('gallery.empty')}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          {t('gallery.back')}
        </button>
      </header>
      <section className="gallery-grid">
        {CHARACTERS.flatMap((character) =>
          RESULT_KINDS.map((result) => {
            const id = `${character}_${result}`;
            const isUnlocked = unlocked.has(id);
            const imageKey = `bg_${character}_${result}` as AssetKey;
            const label = t('gallery.view', {
              character: t(`character.${character}.name`),
              result: t(`gallery.${result}`),
            });
            return (
              <figure className={`gallery-card${isUnlocked ? ' is-unlocked' : ''}`} key={id}>
                {isUnlocked ? (
                  <button
                    className="gallery-photo gallery-photo-button"
                    type="button"
                    aria-label={label}
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setSelectedCg({ character, result });
                    }}
                  >
                    <img src={assets[imageKey]} alt="" draggable={false} />
                  </button>
                ) : (
                  <div className="gallery-photo">
                    <img src={assets[imageKey]} alt="" draggable={false} />
                    <div className="gallery-lock" aria-label={t('gallery.locked')}>?</div>
                  </div>
                )}
                <figcaption>
                  <strong>{t(`character.${character}.name`)}</strong>
                  <span>{t(`gallery.${result}`)}</span>
                </figcaption>
              </figure>
            );
          }),
        )}
      </section>
      {selectedCg && selectedImageKey && (
        <div
          className="gallery-lightbox"
          role="presentation"
          data-ui-sfx
          onMouseDown={closeLightbox}
        >
          <img
            className="gallery-lightbox-backdrop"
            src={assets[selectedImageKey]}
            alt=""
            draggable={false}
          />
          <figure
            ref={dialogRef}
            className="gallery-lightbox-frame"
            role="dialog"
            aria-modal="true"
            aria-label={selectedLabel}
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <img src={assets[selectedImageKey]} alt={selectedLabel} draggable={false} />
            <figcaption>
              <strong>{t(`character.${selectedCg.character}.name`)}</strong>
              <span>{t(`gallery.${selectedCg.result}`)}</span>
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}
