import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetMap } from './config/assets';
import { AUDIO_VOLUME, type SfxKey } from './config/audio';
import { STORAGE_KEYS, type CharacterId } from './config/game';
import { ClassroomControls } from './components/ClassroomControls';
import { GalleryScreen } from './components/GalleryScreen';
import { GameScreen, type GameOutcome } from './components/GameScreen';
import { HomeScreen } from './components/HomeScreen';
import { ResultScreen } from './components/ResultScreen';
import { nextHighScore } from './game/logic';
import { loadAssets } from './services/assets';
import {
  getInitialLocale,
  loadMessages,
  translate,
  type Locale,
  type Messages,
} from './services/locale';
import {
  ALL_CG_IDS,
  advanceSecretSequence,
  isSecretTriggerCorner,
  SECRET_HOLD_DURATION_MS,
  SECRET_POINTER_TOLERANCE_PX,
} from './services/secretUnlock';

type Screen = 'home' | 'game' | 'result' | 'gallery';

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
    const onContextMenu = (event: MouseEvent) => {
      if (holdPointer.current && isSecretTriggerCorner(event.clientX, event.clientY)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerEnd, true);
    window.addEventListener('pointercancel', onPointerEnd, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      cancelHold();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerEnd, true);
      window.removeEventListener('pointercancel', onPointerEnd, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [enabled, onActivate]);
}

export function App() {
  const [assets, setAssets] = useState<AssetMap | null>(null);
  const [progress, setProgress] = useState(0);
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [messages, setMessages] = useState<Messages>({});
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState(0);
  const [character, setCharacter] = useState<CharacterId>('asteria');
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(readUnlocked);
  const [secretUnlockNotice, setSecretUnlockNotice] = useState(0);
  const [bgmEnabled, setBgmEnabled] = useState(() => readToggle(STORAGE_KEYS.bgm));
  const [sfxEnabled, setSfxEnabled] = useState(() => readToggle(STORAGE_KEYS.sfx));
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let current = true;
    loadAssets((loaded, total) => setProgress(Math.round((loaded / total) * 100))).then((result) => {
      if (current) setAssets(result);
    });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    loadMessages(locale).then((result) => {
      if (current) setMessages(result);
    });
    localStorage.setItem(STORAGE_KEYS.locale, locale);
    document.documentElement.lang = locale;
    return () => {
      current = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!assets) return;
    const bgm = new Audio(assets.bgm_classroom_loop);
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = AUDIO_VOLUME.bgm_classroom_loop;
    bgmRef.current = bgm;
    return () => {
      bgm.pause();
      bgmRef.current = null;
    };
  }, [assets]);

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
  }, [assets, bgmEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sfx, String(sfxEnabled));
  }, [sfxEnabled]);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => translate(messages, key, values),
    [messages],
  );

  const playSfx = useCallback((key: SfxKey) => {
    if (!assets || !sfxEnabled) return;
    const sound = new Audio(assets[key]);
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
    Boolean(assets && Object.keys(messages).length > 0),
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
    document.addEventListener('dragstart', preventImageDrag, true);
    return () => document.removeEventListener('dragstart', preventImageDrag, true);
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

  const loadingText = useMemo(
    () => translate(messages, 'loading.assets', { progress }),
    [messages, progress],
  );

  if (!assets || Object.keys(messages).length === 0) {
    return (
      <main className="loading-screen">
        <div className="loading-mark" aria-hidden="true" />
        {messages['app.title'] && <h1>{messages['app.title']}</h1>}
        <div className="loading-track"><span style={{ width: `${progress}%` }} /></div>
        {messages['loading.assets'] && <p>{loadingText}</p>}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <ClassroomControls
        locale={locale}
        bgmEnabled={bgmEnabled}
        sfxEnabled={sfxEnabled}
        t={t}
        onLocaleChange={setLocale}
        onBgmToggle={() => setBgmEnabled((enabled) => !enabled)}
        onSfxToggle={() => setSfxEnabled((enabled) => !enabled)}
      />
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
          onReplay={() => {
            setSession((value) => value + 1);
            setScreen('game');
          }}
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
