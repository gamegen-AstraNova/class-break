import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import type { AssetKey, AssetMap } from '../config/assets';
import { AUDIO_VOLUME } from '../config/audio';
import {
  CHARACTERS,
  CHARACTER_POSITION,
  BLACKBOARD_FORMULAS,
  LESSON,
  type CharacterId,
} from '../config/game';
import {
  allStudentsAreSlacking,
  classmateFollowChance,
  formatSeconds,
  nextTeacherPosition,
  randomBetween,
  accumulateScore,
  shouldTeacherPause,
  shouldTeacherTurn,
  type ResultKind,
  type TeacherPhase,
} from '../game/logic';

export interface GameOutcome {
  character: CharacterId;
  kind: ResultKind;
  score: number;
}

interface GameScreenProps {
  assets: AssetMap;
  character: CharacterId;
  t: (key: string, values?: Record<string, string | number>) => string;
  sfxEnabled: boolean;
  playSfx: (key: 'sfx_warning' | 'sfx_caught' | 'sfx_win') => void;
  onFinish: (outcome: GameOutcome) => void;
}

interface BlackboardFormula {
  id: number;
  text: string;
  column: 'left' | 'center' | 'right';
  rotation: number;
}

function useLoopingAudio(source: string, enabled: boolean, volume: number) {
  useEffect(() => {
    if (!enabled) return;
    const audio = new Audio(source);
    audio.loop = true;
    audio.volume = volume;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [enabled, source, volume]);
}

function StudentSeat({
  assets,
  character,
  slacking,
}: {
  assets: AssetMap;
  character: CharacterId;
  slacking: boolean;
}) {
  const state = slacking ? 'slack' : 'listen';
  const spriteKey = `sym_${character}_${state}` as AssetKey;
  return (
    <div
      className={`student-seat student-seat--${character}${state === 'slack' ? ' is-slacking' : ''}`}
      style={{ left: `${CHARACTER_POSITION[character]}%` }}
      aria-hidden="true"
    >
      <img className="desk-layer" src={assets.deco_classroom_desk} alt="" draggable={false} />
      <img className="student-layer" src={assets[spriteKey]} alt="" draggable={false} />
      <img className="chair-layer" src={assets.deco_classroom_chair} alt="" draggable={false} />
    </div>
  );
}

export function GameScreen({
  assets,
  character,
  t,
  sfxEnabled,
  playSfx,
  onFinish,
}: GameScreenProps) {
  const [phase, setPhase] = useState<TeacherPhase>('writing');
  const [holding, setHolding] = useState(false);
  const [score, setScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [teacherPosition, setTeacherPosition] = useState(50);
  const [teacherWalkMs, setTeacherWalkMs] = useState<number>(LESSON.teacherWalkMinMs);
  const [teacherWalking, setTeacherWalking] = useState(false);
  const [formulas, setFormulas] = useState<BlackboardFormula[]>([]);
  const [classmatesSlacking, setClassmatesSlacking] = useState<CharacterId[]>([]);
  const [classroomAttention, setClassroomAttention] = useState(false);
  const phaseRef = useRef<TeacherPhase>('writing');
  const holdingRef = useRef(false);
  const activeRef = useRef(true);
  const scoreRef = useRef(0);
  const holdMsRef = useRef(0);
  const teacherPositionRef = useRef(50);
  const formulaIdRef = useRef(0);
  const classmatesSlackingRef = useRef<CharacterId[]>([]);
  const classroomAttentionRef = useRef(false);
  const beginClassroomAttentionRef = useRef<() => void>(() => undefined);
  const cancelClassroomAttentionRef = useRef<() => void>(() => undefined);

  useLoopingAudio(
    assets.sfx_teacher_walk_loop,
    sfxEnabled && teacherWalking,
    AUDIO_VOLUME.sfx_teacher_walk_loop,
  );
  useLoopingAudio(
    assets.sfx_teacher_write_loop,
    sfxEnabled && phase === 'writing',
    AUDIO_VOLUME.sfx_teacher_write_loop,
  );

  const updateClassmatesSlacking = useCallback(
    (update: (current: CharacterId[]) => CharacterId[]) => {
      const next = update(classmatesSlackingRef.current);
      classmatesSlackingRef.current = next;
      setClassmatesSlacking(next);
    },
    [],
  );

  const updatePhase = useCallback((next: TeacherPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const updateClassroomAttention = useCallback((active: boolean) => {
    classroomAttentionRef.current = active;
    setClassroomAttention(active);
  }, []);

  const release = useCallback(() => {
    holdingRef.current = false;
    holdMsRef.current = 0;
    setHolding(false);
  }, []);

  const finish = useCallback(
    (kind: ResultKind) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      release();
      playSfx(kind === 'win' ? 'sfx_win' : 'sfx_caught');
      onFinish({ character, kind, score: Math.round(scoreRef.current) });
    },
    [character, onFinish, playSfx, release],
  );

  const begin = useCallback(() => {
    if (!activeRef.current || holdingRef.current) return;
    if (phaseRef.current !== 'writing') {
      finish('caught');
      return;
    }
    holdingRef.current = true;
    setHolding(true);
  }, [finish]);

  useEffect(() => {
    let teacherTimer = 0;
    let attentionTimer = 0;
    const addFormula = (position: number) => {
      const text = BLACKBOARD_FORMULAS[Math.floor(Math.random() * BLACKBOARD_FORMULAS.length)];
      const positionRatio = (
        (position - LESSON.teacherPositionMin)
        / (LESSON.teacherPositionMax - LESSON.teacherPositionMin)
      );
      const formula: BlackboardFormula = {
        id: formulaIdRef.current += 1,
        text,
        column: positionRatio < 1 / 3 ? 'left' : positionRatio > 2 / 3 ? 'right' : 'center',
        rotation: randomBetween(-1.5, 1.5),
      };
      setFormulas((current) => [...current, formula].slice(-LESSON.boardFormulaLimit));
    };

    const clearClassroomAttention = () => {
      window.clearTimeout(attentionTimer);
      updateClassroomAttention(false);
    };

    const startWarning = () => {
      if (!activeRef.current || phaseRef.current !== 'writing') return;
      window.clearTimeout(teacherTimer);
      clearClassroomAttention();
      updateClassmatesSlacking(() => []);
      setTeacherWalking(false);
      updatePhase('warning');
      teacherTimer = window.setTimeout(() => {
        if (!activeRef.current) return;
        updatePhase('watching');
        if (holdingRef.current) {
          finish('caught');
          return;
        }
        teacherTimer = window.setTimeout(
          startWriting,
          randomBetween(LESSON.watchingMinMs, LESSON.watchingMaxMs),
        );
      }, LESSON.teacherReactionMs);
    };

    const startWriting = () => {
      if (!activeRef.current) return;
      updatePhase('writing');
      const nextPosition = nextTeacherPosition(teacherPositionRef.current);
      const walkDuration = randomBetween(LESSON.teacherWalkMinMs, LESSON.teacherWalkMaxMs);
      teacherPositionRef.current = nextPosition;
      setTeacherWalkMs(walkDuration);
      setTeacherWalking(true);
      setTeacherPosition(nextPosition);
      teacherTimer = window.setTimeout(() => {
        if (!activeRef.current) return;
        addFormula(nextPosition);
        if (!shouldTeacherPause()) {
          startWriting();
          return;
        }
        setTeacherWalking(false);
        teacherTimer = window.setTimeout(() => {
          if (!activeRef.current) return;
          if (shouldTeacherTurn()) startWarning();
          else startWriting();
        }, LESSON.teacherPauseMs);
      }, walkDuration);
    };
    beginClassroomAttentionRef.current = () => {
      if (
        !activeRef.current
        || phaseRef.current !== 'writing'
        || classroomAttentionRef.current
      ) return;
      updateClassroomAttention(true);
      playSfx('sfx_warning');
      attentionTimer = window.setTimeout(() => {
        if (!activeRef.current) return;
        if (!allStudentsAreSlacking(
          holdingRef.current,
          classmatesSlackingRef.current.length,
        )) {
          clearClassroomAttention();
          return;
        }
        if (phaseRef.current !== 'writing') {
          clearClassroomAttention();
          return;
        }
        startWarning();
      }, LESSON.classroomAttentionMs);
    };
    cancelClassroomAttentionRef.current = () => {
      if (!activeRef.current || !classroomAttentionRef.current) return;
      clearClassroomAttention();
    };
    startWriting();
    return () => {
      beginClassroomAttentionRef.current = () => undefined;
      cancelClassroomAttentionRef.current = () => undefined;
      window.clearTimeout(teacherTimer);
      window.clearTimeout(attentionTimer);
    };
  }, [finish, playSfx, updateClassroomAttention, updateClassmatesSlacking, updatePhase]);

  useEffect(() => {
    let timer = 0;
    const classmates = CHARACTERS.filter((student) => student !== character);

    const checkForFollowers = () => {
      if (phaseRef.current === 'writing' && holdingRef.current) {
        const followChance = classmateFollowChance(holdMsRef.current);
        updateClassmatesSlacking((current) => (
          classmates.reduce<CharacterId[]>((next, student) => (
            next.includes(student) || Math.random() >= followChance
              ? next
              : [...next, student]
          ), current)
        ));
      }
      timer = window.setTimeout(checkForFollowers, LESSON.classmateFollowIntervalMs);
    };

    timer = window.setTimeout(checkForFollowers, LESSON.classmateFollowIntervalMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [character, updateClassmatesSlacking]);

  useEffect(() => {
    const everyoneSlacking = allStudentsAreSlacking(holding, classmatesSlacking.length);
    if (everyoneSlacking && phaseRef.current === 'writing' && !classroomAttention) {
      beginClassroomAttentionRef.current();
    } else if (!everyoneSlacking && classroomAttention) {
      cancelClassroomAttentionRef.current();
    }
  }, [classmatesSlacking, classroomAttention, holding]);

  useEffect(() => {
    const startedAt = performance.now();
    let previous = startedAt;
    let frame = 0;
    const tick = (now: number) => {
      if (!activeRef.current) return;
      const delta = Math.min(50, now - previous);
      previous = now;
      const nextElapsed = Math.min(LESSON.durationMs, now - startedAt);
      setElapsedMs(nextElapsed);

      if (holdingRef.current && phaseRef.current === 'writing') {
        holdMsRef.current += delta;
        scoreRef.current = accumulateScore(scoreRef.current, holdMsRef.current, delta);
        setScore(scoreRef.current);
      }

      if (nextElapsed >= LESSON.durationMs) {
        finish(scoreRef.current >= LESSON.targetScore ? 'win' : 'timeup');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finish]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      begin();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      release();
    };
    const loseFocus = () => release();
    const visibility = () => {
      if (document.hidden) release();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', loseFocus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', loseFocus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [begin, release]);

  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    begin();
  };
  const progress = Math.min(100, (score / LESSON.targetScore) * 100);
  const remaining = LESSON.durationMs - elapsedMs;
  const focusShift = character === 'asteria' ? 250 : character === 'lumi' ? -250 : 0;
  const visibleStatusPhase = phase === 'warning' ? 'watching' : phase;
  const everyoneSlacking = allStudentsAreSlacking(holding, classmatesSlacking.length);
  const statusKey = classroomAttention
    ? everyoneSlacking ? 'status.allSlacking' : 'status.classmatesSlacking'
    : `status.${visibleStatusPhase}`;
  const teacherIsFacingClass = phase !== 'writing';
  const teacherKey: AssetKey = teacherIsFacingClass
    ? 'sym_teacher_teaching'
    : 'sym_teacher_writing';
  const teacherPose = teacherIsFacingClass ? 'teaching' : 'writing';

  return (
    <main className={`game-screen phase-${phase}${holding ? ' is-holding' : ''}`}>
      <header className="hud">
        <div className="hud-block hud-score">
          <span>{t('hud.score')}</span>
          <strong>{Math.round(score).toLocaleString()}</strong>
          <small>{t('hud.goal', { score: LESSON.targetScore.toLocaleString() })}</small>
        </div>
        <div className="score-track" aria-label={t('hud.score')}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="hud-block hud-time">
          <span>{t('hud.time')}</span>
          <strong>00:{formatSeconds(remaining)}</strong>
        </div>
      </header>

      <section
        className="stage-viewport"
        onPointerDown={pointerDown}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="stage-scene" style={{ '--focus-shift': `${focusShift}px` } as CSSProperties}>
          <img className="classroom-bg" src={assets.bg_classroom} alt="" draggable={false} />
          <div className="blackboard-artboard" aria-hidden="true">
            <div className="blackboard-formulas">
              {formulas.map((formula, row) => (
                <span
                  key={formula.id}
                  className={`blackboard-formula blackboard-formula--${formula.column}`}
                  style={{
                    top: `${18 + row * 32}%`,
                    '--formula-rotation': `${formula.rotation}deg`,
                  } as CSSProperties}
                >
                  {formula.text}
                </span>
              ))}
            </div>
          </div>
          <img
            className={`teacher-layer teacher-layer--${teacherPose}${teacherWalking ? ' is-walking' : ''}`}
            style={{
              '--teacher-x': `${teacherPosition}%`,
              '--teacher-walk-duration': `${teacherWalkMs}ms`,
            } as CSSProperties}
            src={assets[teacherKey]}
            alt=""
            draggable={false}
          />
          {CHARACTERS.map((student) => (
            <StudentSeat
              key={student}
              assets={assets}
              character={student}
              slacking={student === character ? holding : classmatesSlacking.includes(student)}
            />
          ))}
          {classroomAttention && (
            <div
              className="attention-meter"
              role="alert"
              aria-label={t(statusKey)}
              style={{
                '--attention-duration': `${LESSON.classroomAttentionMs}ms`,
              } as CSSProperties}
            >
              <img
                className="attention-symbol attention-symbol--empty"
                src={assets.icon_caution}
                alt=""
                draggable={false}
              />
              <span className="attention-fill" aria-hidden="true">
                <img
                  className="attention-symbol attention-symbol--filled"
                  src={assets.icon_caution}
                  alt=""
                  draggable={false}
                />
              </span>
            </div>
          )}
          <div className={`teacher-status teacher-status--${visibleStatusPhase}`}>{t(statusKey)}</div>
        </div>
      </section>

      <section className="control-panel">
        <p>{t('control.hint')}</p>
      </section>
    </main>
  );
}
