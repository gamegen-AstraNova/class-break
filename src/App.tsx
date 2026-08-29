import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetMap } from './config/assets';
import { AUDIO_VOLUME, type SfxKey } from './config/audio';
import { STORAGE_KEYS, type CharacterId } from './config/game';
import { ClassroomControls } from './components/ClassroomControls';
import { GalleryScreen } from './components/GalleryScreen';
import { GameScreen, type GameOutcome } from './components/GameScreen';
import { HomeScreen } from './components/HomeScreen';
import { ResultScreen } from './components/ResultScreen';
import { nextHighScore } from './game/logic';
import { createPreloadedAudio, primePreloadedAudio } from './services/assets';
import {
  getInitialLocale,
  translate,
  type Locale,
  type MessagePacks,
} from './services/locale';
import {
  ALL_CG_IDS,
  advanceSecretSequence,
  isSecretTriggerCorner,
  SECRET_HOLD_DURATION_MS,
  SECRET_POINTER_TOLERANCE_PX,
} from './services/secretUnlock';

type Screen = 'home' | 'game' | 'result' | 'gallery';

interface AppProps {
  assets: AssetMap;
  messagePacks: MessagePacks;
}

function LaunchGate({
  iconSchool,
  backgroundImage,
  t,
  onEnter,
}: {
  iconSchool: string;
  backgroundImage: string;
  t: (key: string) => string;
  onEnter: () => void;
}) {
  const [entering, setEntering] = useState(false);
  const enter = async () => {
    if (entering) return;
    setEntering(true);
    await primePreloadedAudio();
    onEnter();
  };
  return (
    <main
      className="loading-screen"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <section className="launch-card">
        <div className="launch-brand">
          <img className="loading-logo" src={iconSchool} alt="" />
          <h1>{t('app.title')}</h1>
        </div>
        <button className="primary-button" type="button" disabled={entering} onClick={() => void enter()}>
          {t(entering ? 'launch.entering' : 'launch.enter')}
        </button>
      </section>
    </main>
  );
}

function readUnlocked(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.unlocked) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function readToggle(key: string): boolean {
  return localStorage.getItem(key) !== 'false';
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function useSecretUnlockTriggers(onActivate: () => void, enabled: boolean): void {
  const sequenceIndex = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const holdPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressCornerClickUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const cancelHold = () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      holdPointer.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTextEntryTarget(event.target)) return;
      const result = advanceSecretSequence(sequenceIndex.current, event.key);
      sequenceIndex.current = result.nextIndex;
      if (result.completed) onActivate();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse'
        || !isSecretTriggerCorner(event.clientX, event.clientY)) return;
      cancelHold();
      holdPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        holdPointer.current = null;
        suppressCornerClickUntil.current = performance.now() + 1_000;
        onActivate();
      }, SECRET_HOLD_DURATION_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      const start = holdPointer.current;
      if (start?.id === event.pointerId
        && Math.hypot(event.clientX - start.x, event.clientY - start.y)
          > SECRET_POINTER_TOLERANCE_PX) {
        cancelHold();
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (holdPointer.current?.id === event.pointerId) cancelHold();
    };
    const onClick = (event: MouseEvent) => {
      if (performance.now() <= suppressCornerClickUntil.current
        && isSecretTriggerCorner(event.clientX, event.clientY)) {
        suppressCornerClickUntil.current = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerEnd, true);
    window.addEventListener('pointercancel', onPointerEnd, true);
    window.addEventListener('click', onClick, true);
    return () => {
      cancelHold();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerEnd, true);
      window.removeEventListener('pointercancel', onPointerEnd, true);
      window.removeEventListener('click', onClick, true);
    };
  }, [enabled, onActivate]);
}

export function App({ assets, messagePacks }: AppProps) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [launched, setLaunched] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState(0);
  const [character, setCharacter] = useState<CharacterId>('asteria');
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(readUnlocked);
  const [secretUnlockNotice, setSecretUnlockNotice] = useState(0);
  const [bgmEnabled, setBgmEnabled] = useState(() => readToggle(STORAGE_KEYS.bgm));
  const [sfxEnabled, setSfxEnabled] = useState(() => readToggle(STORAGE_KEYS.sfx));
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const messages = messagePacks[locale] ?? messagePacks.en;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.locale, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!launched) return;
    const bgm = createPreloadedAudio(assets.bgm_classroom_loop);
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = AUDIO_VOLUME.bgm_classroom_loop;
    bgmRef.current = bgm;
    return () => {
      bgm.pause();
      bgmRef.current = null;
    };
  }, [assets.bgm_classroom_loop, launched]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bgm, String(bgmEnabled));
    const bgm = bgmRef.current;
    if (!bgm) return;
    if (!bgmEnabled) {
      bgm.pause();
      return;
    }
    const start = () => void bgm.play().catch(() => undefined);
    start();
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, [bgmEnabled, launched]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sfx, String(sfxEnabled));
  }, [sfxEnabled]);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => translate(messages, key, values),
    [messages],
  );

  const playSfx = useCallback((key: SfxKey) => {
    if (!sfxEnabled) return;
    const sound = createPreloadedAudio(assets[key]);
    sound.volume = AUDIO_VOLUME[key];
    void sound.play().catch(() => undefined);
  }, [assets, sfxEnabled]);

  const activateSecretUnlock = useCallback(() => {
    const allUnlocked = new Set(ALL_CG_IDS);
    localStorage.setItem(STORAGE_KEYS.unlocked, JSON.stringify(ALL_CG_IDS));
    setUnlocked(allUnlocked);
    setSecretUnlockNotice((current) => current + 1);
  }, []);
  useSecretUnlockTriggers(
    activateSecretUnlock,
    launched,
  );

  useEffect(() => {
    if (secretUnlockNotice === 0) return undefined;
    const timer = window.setTimeout(() => setSecretUnlockNotice(0), 2_800);
    return () => window.clearTimeout(timer);
  }, [secretUnlockNotice]);

  useEffect(() => {
    const playInterfaceClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const directSurface = target.closest('[data-ui-sfx]');
      if (target.closest('button, select') || directSurface === target) playSfx('sfx_ui_click');
    };
    document.addEventListener('pointerdown', playInterfaceClick);
    return () => document.removeEventListener('pointerdown', playInterfaceClick);
  }, [playSfx]);

  useEffect(() => {
    const preventImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };
    const preventSelection = (event: Event) => event.preventDefault();
    document.addEventListener('dragstart', preventImageDrag, true);
    document.addEventListener('selectstart', preventSelection, true);
    document.addEventListener('contextmenu', preventSelection, true);
    return () => {
      document.removeEventListener('dragstart', preventImageDrag, true);
      document.removeEventListener('selectstart', preventSelection, true);
      document.removeEventListener('contextmenu', preventSelection, true);
    };
  }, []);

  const completeGame = useCallback((nextOutcome: GameOutcome) => {
    const storedHighScore = Number(localStorage.getItem(STORAGE_KEYS.highScore));
    localStorage.setItem(
      STORAGE_KEYS.highScore,
      String(nextHighScore(storedHighScore, nextOutcome.score)),
    );
    setOutcome(nextOutcome);
    const unlockId = `${nextOutcome.character}_${nextOutcome.kind}`;
    setUnlocked((previous) => {
      const next = new Set(previous).add(unlockId);
      localStorage.setItem(STORAGE_KEYS.unlocked, JSON.stringify([...next]));
      return next;
    });
    setScreen('result');
  }, []);

  if (!launched) {
    return (
      <LaunchGate
        iconSchool={assets.icon_school}
        backgroundImage={assets.bg_home_classroom}
        t={t}
        onEnter={() => setLaunched(true)}
      />
    );
  }

  return (
    <div className="app-shell">
      {screen !== 'game' && (
        <ClassroomControls
          locale={locale}
          bgmEnabled={bgmEnabled}
          sfxEnabled={sfxEnabled}
          t={t}
          onLocaleChange={setLocale}
          onBgmToggle={() => setBgmEnabled((enabled) => !enabled)}
          onSfxToggle={() => setSfxEnabled((enabled) => !enabled)}
        />
      )}
      {screen === 'home' && (
        <HomeScreen
          assets={assets}
          selected={character}
          t={t}
          onSelect={setCharacter}
          onStart={() => {
            setOutcome(null);
            setSession((value) => value + 1);
            setScreen('game');
          }}
          onGallery={() => setScreen('gallery')}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          key={`${character}-${session}`}
          assets={assets}
          character={character}
          t={t}
          sfxEnabled={sfxEnabled}
          playSfx={playSfx}
          onFinish={completeGame}
        />
      )}
      {screen === 'result' && outcome && (
        <ResultScreen
          assets={assets}
          outcome={outcome}
          t={t}
          onHome={() => setScreen('home')}
        />
      )}
      {screen === 'gallery' && (
        <GalleryScreen assets={assets} unlocked={unlocked} t={t} onBack={() => setScreen('home')} />
      )}
      {secretUnlockNotice > 0 && (
        <div
          key={secretUnlockNotice}
          className="secret-unlock-toast"
          role="status"
          aria-live="assertive"
        >
          <span aria-hidden="true">✦</span>
          <strong>{t('secret.unlockAll')}</strong>
          <span aria-hidden="true">✦</span>
        </div>
      )}
    </div>
  );
}
