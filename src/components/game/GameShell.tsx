// @ts-nocheck — imported game code, typed under the original looser tsconfig
import React, { useEffect, useRef, useState } from 'react';
import { gameAudio } from '../../game/audio';
import { LORE_CODEX } from '../../game/cutscenes';
import { GameEngine } from '../../game/engine';
import { pollPrimaryGamepad, triggerGamepadRumble } from '../../game/gamepad';
import { getHeroDef, HEROES } from '../../game/heroes';
import { TOTAL_MECHANICS } from '../../game/mechanicsCatalog';
import { BOSS_ORDER, getPlayModeDef } from '../../game/modes';
import { PixelRenderer } from '../../game/renderer';
import {
  BOON_MAP,
  decodeVirtualJoystick,
  ELEMENT_META,
  SPIRIT_MAP,
  TITLE_MAP,
  WEATHER_META,
} from '../../game/systems';
import {
  HudSnapshot,
  InputState,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from '../../game/types';
import { BlessingShopModal } from './BlessingShopModal';
import { ChroniclesModal } from './ChroniclesModal';
import { CompendiumModal } from './CompendiumModal';
import { CutsceneOverlay } from './CutsceneOverlay';
import { DefeatModal } from './DefeatModal';
import { HeroSelectModal, HeroSpritePreview } from './HeroSelectModal';
import { LoadoutSanctuaryModal } from './LoadoutSanctuaryModal';
import { ModeSelectModal } from './ModeSelectModal';
import { PauseModal } from './PauseModal';
import { PixelButton, PixelIcon, PixelWindow } from './PixelUi';
import { StageSelectModal } from './StageSelectModal';
import { VictoryModal } from './VictoryModal';
import { CinematicFX } from './CinematicFX';

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GameShell: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const haloRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<PixelRenderer | null>(null);
  const staminaBarRef = useRef<HTMLDivElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [overlay, setOverlay] = useState<
    'none' | 'map' | 'compendium' | 'heroes' | 'blessings' | 'chronicles' | 'modes' | 'sanctuary'
  >('none');
  const [showRadar, setShowRadar] = useState(true);
  const [showTouchControls, setShowTouchControls] = useState(() =>
    typeof window !== 'undefined' &&
    (('ontouchstart' in window) || window.innerWidth <= 900)
  );
  const touchManualRef = useRef(false);
  const lastStaminaRef = useRef(-1);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [gamepadConfirmTick, setGamepadConfirmTick] = useState(0);
  const [gamepadSkipTick, setGamepadSkipTick] = useState(0);
  const prevGamepadConnectedRef = useRef<string | null>(null);

  const keysHeld = useRef<Set<string>>(new Set());
  const keysJustPressed = useRef<Set<string>>(new Set());
  const touchHeld = useRef<Record<string, boolean>>({});
  const touchJustPressed = useRef<Record<string, boolean>>({});
  const analogRef = useRef<{
    x: number;
    y: number;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }>({ x: 0, y: 0, left: false, right: false, up: false, down: false });
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);

  const focusViewport = () => {
    viewportRef.current?.focus({ preventScroll: true });
  };

  // Sync body.dataset.state cleanly
  useEffect(() => {
    if (hud) {
      document.body.dataset.state = hud.mode;
    }
  }, [hud?.mode]);

  // Keep mobile touch joystick responsive across viewport resizes
  useEffect(() => {
    const onResize = () => {
      if (touchManualRef.current) return;
      setShowTouchControls(('ontouchstart' in window) || window.innerWidth <= 900);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mount isolated simulation + render loop ONCE
  useEffect(() => {
    const engine = new GameEngine((snap) => {
      const activeEngine = engineRef.current;
      if (activeEngine?.openBlessingsRequested) {
        activeEngine.openBlessingsRequested = false;
        setOverlay('blessings');
      }
      setHud(snap);
      if (staminaBarRef.current && Math.abs(snap.staminaRatio - lastStaminaRef.current) > 0.002) {
        lastStaminaRef.current = snap.staminaRatio;
        staminaBarRef.current.style.transform = `scaleX(${snap.staminaRatio})`;
      }
    });
    engine.onRumble = triggerGamepadRumble;
    const renderer = new PixelRenderer();
    engineRef.current = engine;
    rendererRef.current = renderer;

    // Support ?autostart=1 without triggering autoplay AudioContext warning or cutscene modal
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.skipNextAutoCutscene = true;
      engine.startPlaying(false);
      const previewVictory = params.get('previewVictory');
      const previewDefeat = params.get('previewDefeat');
      if (previewVictory === 'stage') {
        engine.mode = 'stage_clear';
        engine.emitHud();
      } else if (previewVictory === 'final') {
        engine.victory = true;
        engine.mode = 'gameover';
        engine.emitHud();
      } else if (previewDefeat === 'survival') {
        engine.startPlayMode('survival', true);
        engine.survivalWave = 7;
        engine.survivalKills = 42;
        engine.bestSurvivalWave = 7;
        engine.perfectDodges = 4;
        engine.totalParries = 2;
        engine.mode = 'gameover';
        engine.victory = false;
        engine.emitHud();
      } else if (previewDefeat === 'tower') {
        engine.startPlayMode('tower', true);
        engine.loadTowerFloor(6);
        engine.bestTowerFloor = 6;
        engine.perfectDodges = 5;
        engine.totalParries = 3;
        engine.mode = 'gameover';
        engine.victory = false;
        engine.emitHud();
      } else if (previewDefeat === 'boss') {
        engine.practiceBoss('boss_ignis_rex');
        const boss = engine.liveEntities.find((e) => e.def.kind === 'boss_ignis_rex');
        if (boss) {
          boss.hp = 4;
          boss.maxHp = 10;
        }
        engine.perfectDodges = 3;
        engine.totalParries = 1;
        engine.hardcoreGameOver = true;
        engine.mode = 'gameover';
        engine.victory = false;
        engine.emitHud();
      } else if (previewDefeat === '1') {
        engine.hardcoreGameOver = true;
        engine.mode = 'gameover';
        engine.victory = false;
        engine.emitHud();
      }
    } else {
      setHud(engine.getSnapshot());
    }

    const resolveGameTokens = (e: KeyboardEvent): string[] => {
      const tokens: string[] = [];
      if (e.code) tokens.push(e.code);
      const k = e.key?.toLowerCase();
      if (k === 'arrowleft' || k === 'a') tokens.push('MOVE_LEFT');
      if (k === 'arrowright' || k === 'd') tokens.push('MOVE_RIGHT');
      if (k === 'arrowup' || k === 'w') tokens.push('MOVE_UP');
      if (k === 'arrowdown' || k === 's') tokens.push('MOVE_DOWN');
      if (k === ' ' || k === 'z' || k === 'j') tokens.push('ACT_JUMP');
      if (k === 'x' || k === 'k' || k === 'shift') tokens.push('ACT_DASH');
      if (k === 'c' || k === 'l') tokens.push('ACT_GRAB');
      if (k === 'e' || k === 'enter') tokens.push('ACT_INTERACT');
      if (k === 'q') tokens.push('ACT_SKILL');
      if (k === 'f') tokens.push('ACT_SWAP');
      return tokens;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      gameAudio.unlock();
      const code = e.code;
      const keyLow = e.key?.toLowerCase() ?? '';
      const tokens = resolveGameTokens(e);
      const isGameKey =
        code.startsWith('Arrow') ||
        keyLow.startsWith('arrow') ||
        tokens.length > 1 ||
        [
          'Space',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyZ',
          'KeyX',
          'KeyC',
          'KeyE',
          'KeyF',
          'KeyG',
          'KeyQ',
          'KeyB',
          'KeyJ',
          'KeyK',
          'KeyL',
          'ShiftLeft',
          'ShiftRight',
        ].includes(code);

      if (isGameKey && engine.mode === 'playing') {
        e.preventDefault();
      }

      for (const tok of tokens) {
        if (!keysHeld.current.has(tok)) {
          keysJustPressed.current.add(tok);
        }
        keysHeld.current.add(tok);
      }

      // Global shortcuts
      if (engine.mode === 'title' && (code === 'Enter' || code === 'Space' || keyLow === 'enter' || keyLow === ' ')) {
        e.preventDefault();
        setOverlay('none');
        engine.startPlaying();
        keysHeld.current.clear();
        keysJustPressed.current.clear();
        return;
      }

      if (code === 'Tab' && engine.mode === 'playing') {
        e.preventDefault();
        setShowRadar((v) => !v);
        return;
      }

      if (code === 'KeyT' && (engine.mode === 'playing' || engine.mode === 'paused')) {
        e.preventDefault();
        touchManualRef.current = true;
        setShowTouchControls((v) => !v);
        return;
      }

      if (code === 'Escape' || code === 'KeyP' || keyLow === 'escape') {
        e.preventDefault();
        if (engine.mode === 'playing') {
          engine.setPaused(true);
        } else if (engine.mode === 'paused') {
          setOverlay('none');
          engine.setPaused(false);
        } else if (engine.mode === 'title') {
          setOverlay('none');
        }
      } else if ((code === 'KeyM' || keyLow === 'm') && (engine.mode === 'playing' || engine.mode === 'paused')) {
        e.preventDefault();
        setOverlay((cur) => {
          if (cur === 'map') {
            engine.setPaused(false);
            return 'none';
          }
          engine.setPaused(true);
          return 'map';
        });
      } else if (
        (code === 'KeyH' || keyLow === 'h') &&
        (engine.mode === 'title' || engine.mode === 'playing' || engine.mode === 'paused')
      ) {
        e.preventDefault();
        setOverlay((cur) => {
          if (cur === 'heroes') {
            if (engine.mode === 'paused') engine.setPaused(false);
            return 'none';
          }
          if (engine.mode === 'playing') engine.setPaused(true);
          return 'heroes';
        });
      } else if (
        (code === 'KeyB' || keyLow === 'b') &&
        (engine.mode === 'title' || engine.mode === 'playing' || engine.mode === 'paused')
      ) {
        e.preventDefault();
        setOverlay((cur) => {
          if (cur === 'blessings') {
            if (engine.mode === 'paused') engine.setPaused(false);
            return 'none';
          }
          if (engine.mode === 'playing') engine.setPaused(true);
          return 'blessings';
        });
      } else if (
        (code === 'KeyG' || keyLow === 'g') &&
        (engine.mode === 'title' || engine.mode === 'playing' || engine.mode === 'paused')
      ) {
        e.preventDefault();
        setOverlay((cur) => {
          if (cur === 'sanctuary') {
            if (engine.mode === 'paused') engine.setPaused(false);
            return 'none';
          }
          if (engine.mode === 'playing') engine.setPaused(true);
          return 'sanctuary';
        });
      } else if (code === 'KeyN' || keyLow === 'n') {
        gameAudio.toggleMute();
        engine.emitHud();
      } else if ((code === 'KeyR' || keyLow === 'r') && engine.mode === 'playing') {
        engine.killPlayer(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const tokens = resolveGameTokens(e);
      for (const tok of tokens) {
        keysHeld.current.delete(tok);
      }
    };

    const clearInputs = () => {
      keysHeld.current.clear();
      keysJustPressed.current.clear();
      touchHeld.current = {};
      touchJustPressed.current = {};
      analogRef.current = { x: 0, y: 0, left: false, right: false, up: false, down: false };
      if (joyKnobRef.current) joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    };

    const onPointerDown = () => {
      gameAudio.unlock();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    let rafId = 0;
    let lastTs = performance.now();

    const frame = (ts: number) => {
      const rawDt = Math.max(0, (ts - lastTs) / 1000);
      lastTs = ts;

      const pad = pollPrimaryGamepad();
      const activePadName = pad.connected ? pad.id : null;
      if (activePadName !== prevGamepadConnectedRef.current) {
        prevGamepadConnectedRef.current = activePadName;
        setGamepadName(activePadName);
      }
      if (pad.anyPressed) {
        gameAudio.unlock();
      }

      if (engine.activeCutscene) {
        if (pad.confirmJustPressed) setGamepadConfirmTick((c) => c + 1);
        if (pad.skipJustPressed) setGamepadSkipTick((c) => c + 1);
      } else {
        if (pad.pauseJustPressed) {
          if (engine.mode === 'playing') {
            engine.setPaused(true);
          } else if (engine.mode === 'paused') {
            setOverlay('none');
            engine.setPaused(false);
          }
        }
        if (pad.mapJustPressed && (engine.mode === 'playing' || engine.mode === 'paused')) {
          setOverlay((cur) => {
            if (cur === 'map') {
              engine.setPaused(false);
              return 'none';
            }
            engine.setPaused(true);
            return 'map';
          });
        }
        if (engine.mode === 'title' && pad.confirmJustPressed) {
          setOverlay((cur) => {
            if (cur === 'none') {
              engine.startPlaying();
            }
            return cur;
          });
        }
      }

      const held = keysHeld.current;
      const just = keysJustPressed.current;
      const th = touchHeld.current;
      const tj = touchJustPressed.current;
      const ana = analogRef.current;

      const input: InputState = {
        left: held.has('ArrowLeft') || held.has('KeyA') || held.has('MOVE_LEFT') || !!th.left || ana.left || pad.input.left,
        right: held.has('ArrowRight') || held.has('KeyD') || held.has('MOVE_RIGHT') || !!th.right || ana.right || pad.input.right,
        up: held.has('ArrowUp') || held.has('KeyW') || held.has('MOVE_UP') || !!th.up || ana.up || pad.input.up,
        down: held.has('ArrowDown') || held.has('KeyS') || held.has('MOVE_DOWN') || !!th.down || ana.down || pad.input.down,
        analogX: Math.abs(ana.x) > 0 ? ana.x : pad.input.analogX,
        analogY: Math.abs(ana.y) > 0 ? ana.y : pad.input.analogY,
        jumpHeld:
          held.has('Space') ||
          held.has('KeyZ') ||
          held.has('KeyJ') ||
          held.has('ACT_JUMP') ||
          !!th.jump ||
          pad.input.jumpHeld,
        jumpJustPressed:
          just.has('Space') ||
          just.has('KeyZ') ||
          just.has('KeyJ') ||
          just.has('ACT_JUMP') ||
          !!tj.jump ||
          pad.input.jumpJustPressed,
        dashJustPressed:
          just.has('KeyX') ||
          just.has('ShiftLeft') ||
          just.has('ShiftRight') ||
          just.has('KeyK') ||
          just.has('ACT_DASH') ||
          !!tj.dash ||
          pad.input.dashJustPressed,
        grabHeld:
          held.has('KeyC') ||
          held.has('KeyL') ||
          held.has('ACT_GRAB') ||
          !!th.grab ||
          pad.input.grabHeld,
        interactJustPressed:
          just.has('KeyE') ||
          just.has('Enter') ||
          just.has('ACT_INTERACT') ||
          !!tj.interact ||
          pad.input.interactJustPressed,
        skillJustPressed:
          just.has('KeyQ') ||
          just.has('ACT_SKILL') ||
          !!tj.skill ||
          Boolean(pad.input.skillJustPressed),
        swapJustPressed:
          just.has('KeyF') ||
          just.has('ACT_SWAP') ||
          !!tj.swap ||
          Boolean(pad.input.swapJustPressed),
      };
      just.clear();
      touchJustPressed.current = {};

      engine.step(rawDt, input);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderer.render(ctx, engine, Math.min(rawDt, 0.05));
          // High-resolution bloom layer: soft, smooth light bleeding over the crisp pixel art
          const bloom = bloomRef.current;
          const bctx = bloom?.getContext('2d');
          if (bloom && bctx) {
            bctx.globalCompositeOperation = 'copy';
            bctx.filter = 'blur(2px) brightness(1.15) saturate(1.55) contrast(1.45)';
            bctx.drawImage(canvas, 0, 0, bloom.width, bloom.height);
            bctx.filter = 'none';
          }
          // Wide cinematic halo: only the brightest highlights bleed far
          const halo = haloRef.current;
          const hctx = halo?.getContext('2d');
          if (halo && hctx) {
            hctx.globalCompositeOperation = 'copy';
            hctx.filter = 'brightness(0.9) contrast(2.6) saturate(1.8) blur(3px)';
            hctx.drawImage(canvas, 0, 0, halo.width, halo.height);
            hctx.filter = 'none';
          }
        }
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, []);

  const handleStart = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.currentTarget.blur();
    keysHeld.current.clear();
    keysJustPressed.current.clear();
    touchHeld.current = {};
    touchJustPressed.current = {};
    setOverlay('none');
    engineRef.current?.startPlaying();
    focusViewport();
  };

  const handleRestartFull = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.currentTarget.blur();
    keysHeld.current.clear();
    keysJustPressed.current.clear();
    touchHeld.current = {};
    touchJustPressed.current = {};
    setOverlay('none');
    engineRef.current?.resetFullRun();
    engineRef.current?.startPlaying();
    focusViewport();
  };

  const setVirtualKey = (key: string, down: boolean) => {
    gameAudio.unlock();
    if (down && !touchHeld.current[key]) {
      touchJustPressed.current[key] = true;
    }
    touchHeld.current[key] = down;
  };

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const decoded = decodeVirtualJoystick(dx, dy, 40, 0.22);
    analogRef.current = {
      x: decoded.analogX,
      y: decoded.analogY,
      left: decoded.left,
      right: decoded.right,
      up: decoded.up,
      down: decoded.down,
    };
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate3d(${Math.round(decoded.knobX)}px, ${Math.round(
        decoded.knobY
      )}px, 0px)`;
    }
  };

  const resetVirtualJoystick = () => {
    joyPointerIdRef.current = null;
    analogRef.current = { x: 0, y: 0, left: false, right: false, up: false, down: false };
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
  };

  const handleToggleMute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    gameAudio.toggleMute();
    engineRef.current?.emitHud();
  };

  const handleTogglePause = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.mode === 'playing') {
      eng.setPaused(true);
    } else if (eng.mode === 'paused') {
      setOverlay('none');
      eng.setPaused(false);
    }
  };

  const hasSavedProgress =
    hud &&
    (hud.visitedStages.length > 1 ||
      hud.relicsCollected > 0 ||
      hud.deaths > 0 ||
      hud.chapterIndex > 0);

  const activeHero = getHeroDef(hud?.heroId);
  const activeModeDef = getPlayModeDef(hud?.playMode);

  const rankColorMap: Record<string, string> = {
    SS: '#ffe066',
    S: '#ff66dd',
    A: '#52e5ff',
    B: '#66ffaa',
    C: '#e8a87c',
    D: '#9c92b0',
  };

  return (
    <div
      ref={viewportRef}
      tabIndex={-1}
      onMouseDown={() => focusViewport()}
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#07050d] outline-none"
    >
      {/* Isolated Pixel-Art Canvas Viewport (320x180 crisp upscaled) */}
      <div className="relative flex h-full w-full items-center justify-center">
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          data-testid="game-canvas"
          className="pixel-canvas h-full w-full object-contain"
        />
        <canvas
          ref={bloomRef}
          width={160}
          height={90}
          aria-hidden="true"
          className="game-bloom pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          ref={haloRef}
          width={64}
          height={36}
          aria-hidden="true"
          className="game-halo pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        <CinematicFX playing={hud?.mode !== 'title'} />
        <div aria-hidden="true" className="game-lens pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="game-grain pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className={`game-letterbox pointer-events-none absolute inset-0 ${hud?.mode === 'title' ? 'is-open' : ''}`} />
      </div>

      {/* TITLE SCREEN OVERLAY */}
      {hud?.mode === 'title' && overlay === 'none' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none">
          <div className="mt-2 flex max-w-2xl flex-col items-start pointer-events-auto">
            {/* Bespoke Crisp Pixel Emblem */}
            <svg
              viewBox="0 0 420 96"
              shapeRendering="crispEdges"
              className="w-full max-w-md drop-shadow-[0_4px_0_#07050d]"
              role="img"
              aria-label="Aethelgard: Abismo de Cinzas"
            >
              {/* Pixel Mountain Peak + Cyan Prism */}
              <rect x="24" y="8" width="8" height="8" fill="#52e5ff" />
              <rect x="20" y="14" width="16" height="6" fill="#52e5ff" />
              <rect x="26" y="12" width="4" height="4" fill="#ffffff" />
              <rect x="22" y="24" width="12" height="10" fill="#e8a87c" />
              <rect x="18" y="34" width="20" height="12" fill="#e8a87c" />
              <rect x="14" y="46" width="28" height="14" fill="#b87148" />
              <rect x="10" y="60" width="36" height="12" fill="#7d4930" />
              <rect x="22" y="48" width="12" height="24" fill="#07050d" />

              <text
                x="56"
                y="54"
                fill="#f5efe6"
                fontFamily="Pixelify Sans, monospace"
                fontWeight="700"
                fontSize="42"
                letterSpacing="2"
              >
                AETHELGARD
              </text>
              <text
                x="58"
                y="80"
                fill="#ffd27d"
                fontFamily="Pixelify Sans, monospace"
                fontWeight="700"
                fontSize="17"
                letterSpacing="4"
              >
                ABISMO DE CINZAS · 20 FASES
              </text>
            </svg>

            {/* Active Hero + Player Level Showcase Card on Title Screen */}
            <div
              style={{ borderColor: activeHero.accentColor }}
              className="pixel-panel mt-4 flex items-center gap-3.5 px-3.5 py-2.5"
            >
              <div
                style={{ borderColor: activeHero.accentColor }}
                className="flex h-14 w-14 shrink-0 items-center justify-center border-2 bg-[#0c0916]"
              >
                <HeroSpritePreview hero={activeHero} skinId={hud.heroSkinId} sizeClass="h-12 w-12" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-pixel text-[11px] uppercase tracking-wider text-[#b8afc9]">
                    Herói Ativo:
                  </span>
                  <strong
                    style={{ color: activeHero.accentColor }}
                    className="font-pixel text-base font-bold text-stroke-dark"
                  >
                    {activeHero.name}
                  </strong>
                  <span
                    data-testid="title-player-level"
                    className="border border-[#07050d] bg-[#16273b] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#52e5ff]"
                  >
                    NV.{hud.playerLevel}
                  </span>
                  <span className="border border-[#07050d] bg-[#2a1f10] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#ffe47a]">
                    {hud.astralCoins}★
                  </span>
                </div>
                <div className="font-pixel text-xs text-[#efe8fa]">
                  {activeHero.abilityName} ·{' '}
                  <span style={{ color: activeHero.secondaryColor }}>{activeHero.archetype}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden border border-[#07050d] bg-[#120d21]">
                    <div
                      style={{ width: `${Math.round(hud.playerLevelProgress * 100)}%` }}
                      className="h-full bg-[#52e5ff]"
                    />
                  </div>
                  <span className="font-mono-num text-[10px] text-[#b8afc9]">
                    XP {hud.playerCurrentLevelXp}/{hud.playerNextLevelXp}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PixelButton
                type="button"
                variant="gold"
                data-start="true"
                onClick={handleStart}
                className="px-6 py-3 text-lg"
              >
                <PixelIcon name="play" className="h-5 w-5" />
                <span>
                  {hasSavedProgress
                    ? `Continuar Fase ${hud.chapterIndex + 1}`
                    : 'Iniciar Fase 1'}
                </span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="emerald"
                data-testid="open-heroes-btn"
                onClick={() => setOverlay('heroes')}
                className="px-4 py-3 text-base"
              >
                <PixelIcon name="hero" className="h-4 w-4" />
                <span>
                  Heróis ({hud.unlockedHeroes.length}/{HEROES.length})
                </span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="cyan"
                data-testid="open-sanctuary-title-btn"
                onClick={() => setOverlay('sanctuary')}
                className="px-4 py-3 text-base"
              >
                <PixelIcon name="bolt" className="h-4 w-4" />
                <span>Santuário [G]</span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="gold"
                data-testid="open-modes-btn"
                onClick={() => setOverlay('modes')}
                className="px-4 py-3 text-base"
              >
                <PixelIcon name="bolt" className="h-4 w-4" />
                <span>Modos ({activeModeDef.badge})</span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="slate"
                onClick={() => setOverlay('blessings')}
                className="px-4 py-3 text-base text-[#ffe47a]"
              >
                <PixelIcon name="shrine" className="h-4 w-4" />
                <span>Bênçãos ({hud.astralCoins})</span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="cyan"
                onClick={() => setOverlay('map')}
                className="px-4 py-3 text-base"
              >
                <PixelIcon name="stages" className="h-4 w-4" />
                <span>Seleção de Fases</span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="slate"
                onClick={() => setOverlay('compendium')}
                className="px-4 py-3 text-base text-[#52e5ff]"
              >
                <PixelIcon name="book" className="h-4 w-4" />
                <span>{TOTAL_MECHANICS} Mecânicas</span>
              </PixelButton>

              <PixelButton
                type="button"
                variant="slate"
                onClick={() => setOverlay('chronicles')}
                className="px-4 py-3 text-base text-[#ffd27d]"
              >
                <PixelIcon name="flame" className="h-4 w-4" />
                <span>Crônicas & História</span>
              </PixelButton>

              {hasSavedProgress && (
                <PixelButton
                  type="button"
                  variant="slate"
                  onClick={handleRestartFull}
                  className="px-4 py-3 text-base"
                >
                  <PixelIcon name="restart" className="h-4 w-4" />
                  <span>Nova Campanha</span>
                </PixelButton>
              )}
            </div>
          </div>

          {/* Single flat borderless control hint line */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-stroke-dark font-pixel text-sm tracking-wide text-[#e5def2]">
              WASD/Setas · Espaço/Z Pular · X/Shift Dash · C Escalar · Q Poder · F Dupla · G Santuário · T Touch/Joystick
            </p>
            {gamepadName && (
              <span className="border-2 border-[#07050d] bg-[#1a5c49] px-2.5 py-1 font-pixel text-xs font-bold text-[#8effdb]">
                JOYSTICK ATIVO
              </span>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE GAMEPLAY HUD */}
      {hud && hud.mode === 'playing' && (
        <div className="fixed inset-0 z-10 pointer-events-none">
          {/* Top-Left Perimeter Status Cluster (drops cleanly below compact utility row on <640px mobile) */}
          <div className="absolute left-2 top-12 flex max-w-[calc(100vw-16px)] flex-col gap-1 sm:left-4 sm:top-3 sm:max-w-[44vw] sm:gap-1.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {/* Crisp Pixel SVG Dash Gems */}
              <div className="flex items-center gap-1" aria-label={`Cargas de Dash: ${hud.dashes}`}>
                {Array.from({ length: hud.maxDashes }).map((_, i) => {
                  const filled = i < hud.dashes;
                  const fillColor = filled
                    ? hud.maxDashes > 1 && i === 1
                      ? '#ff66dd'
                      : '#52e5ff'
                    : '#1c1829';
                  return (
                    <svg key={i} viewBox="0 0 16 16" shapeRendering="crispEdges" className="h-6 w-6">
                      <path
                        d="M6 1h4v2h2v2h2v4h-2v2h-2v2H6v-2H4v-2H2V5h2V3h2V1z"
                        fill="#07050d"
                      />
                      <path
                        d="M7 2h2v2h2v2h2v2h-2v2H9v2H7v-2H5V8H3V6h2V4h2V2z"
                        fill={fillColor}
                      />
                      {filled && <rect x="6" y="4" width="3" height="3" fill="#ffffff" />}
                    </svg>
                  );
                })}
              </div>

              {/* Crisp Pixel Relic & Astral Coin Counters */}
              <div className="flex items-center gap-1.5 text-stroke-dark">
                <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className="h-5 w-5" aria-hidden="true">
                  <rect x="6" y="1" width="4" height="2" fill="#4df07a" />
                  <path d="M4 3h8v2h2v4h-2v3h-2v2H6v-2H4V9H2V5h2V3z" fill="#07050d" />
                  <path d="M5 4h6v2h2v2h-2v3H9v2H7v-2H5V8H3V6h2V4z" fill="#ff3864" />
                  <rect x="5" y="5" width="2" height="2" fill="#ffffff" />
                </svg>
                <span className="font-mono-num text-base font-bold text-[#f5efe6]">
                  {hud.chapterRelicsCollected}/{hud.chapterTotalRelics}
                </span>
              </div>

              <div className="flex items-center gap-1 text-stroke-dark" aria-label={`Moedas Astrais: ${hud.astralCoins}`}>
                <PixelIcon name="coin" className="h-4 w-4" />
                <span className="font-mono-num text-sm font-bold text-[#ffe47a]">
                  {hud.astralCoins}
                </span>
              </div>

              <div
                data-testid="hud-player-level"
                aria-label={`Nível do Jogador ${hud.playerLevel}`}
                className="flex items-center gap-1.5 border-2 border-[#07050d] bg-[#131e30] px-1.5 py-0.5 shadow-[0_2px_0_0_#07050d]"
              >
                <span className="font-mono-num text-[10px] font-bold text-[#52e5ff]">
                  NV.{hud.playerLevel}
                </span>
                <div className="h-1.5 w-8 overflow-hidden border border-[#07050d] bg-[#08060f]">
                  <div
                    style={{ width: `${Math.round(hud.playerLevelProgress * 100)}%` }}
                    className="h-full bg-[#52e5ff]"
                  />
                </div>
              </div>

              {hud.comboCount > 1 && (
                <div className="border-2 border-[#07050d] bg-[#291547] px-2 py-0.5 font-pixel text-xs font-bold text-[#ff88dd] shadow-[0_2px_0_0_#07050d]">
                  COMBO x{hud.comboCount}
                </div>
              )}

              {/* Live Pixel Style Rank & Score Badge */}
              <div
                aria-label={`Rank de Estilo ${hud.styleRank}`}
                className="flex items-center gap-1.5 border-2 border-[#07050d] bg-[#140e24] px-2 py-0.5 shadow-[0_2px_0_0_#07050d]"
              >
                <span
                  style={{ color: rankColorMap[hud.styleRank] ?? '#ffe066' }}
                  className="font-pixel text-sm font-bold leading-none"
                >
                  {hud.styleRank}
                </span>
                <span className="font-mono-num text-[11px] text-[#d7cee8]">
                  {hud.styleScore}
                </span>
              </div>

              {/* Timer & Deaths */}
              <div className="flex items-center gap-3 text-stroke-dark font-mono-num text-xs text-[#d7cee8]">
                <span>{formatTimer(hud.chapterElapsedSeconds)}</span>
                <span aria-hidden="true">·</span>
                <span>Mortes {hud.chapterDeaths}</span>
              </div>
            </div>

            {/* Pixel Stamina Micro-Bar + Active Hero, [Q] Skill Cooldown, Shield & Checkpoint */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-2.5 w-32 overflow-hidden border-2 border-[#07050d] bg-[#1a1526] shadow-[0_2px_0_0_#07050d]">
                <div
                  ref={staminaBarRef}
                  style={{ transform: `scaleX(${hud.staminaRatio})`, transformOrigin: 'left' }}
                  className={`h-full transition-colors ${
                    hud.staminaRatio < 0.25 ? 'bg-[#ff4455]' : 'bg-[#66ffaa]'
                  }`}
                />
              </div>

              <span
                style={{ color: activeHero.accentColor }}
                className="text-stroke-dark font-pixel text-xs font-bold"
              >
                {activeHero.name}
              </span>

              <span
                style={{
                  borderColor: '#07050d',
                  color: hud.heroSkillCooldown <= 0 ? '#09080f' : '#d7cee8',
                  backgroundColor: hud.heroSkillCooldown <= 0 ? activeHero.secondaryColor : '#1c152e',
                }}
                className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-pixel text-[10px] font-bold"
              >
                <PixelIcon name="bolt" className="h-3 w-3" />
                {hud.heroSkillCooldown <= 0
                  ? '[Q] Pronto'
                  : `[Q] ${hud.heroSkillCooldown.toFixed(1)}s`}
              </span>

              {hud.heroShieldReady && (
                <span className="border border-[#07050d] bg-[#ff7733] px-1.5 py-0.5 font-pixel text-[10px] font-bold text-[#09080f]">
                  ESCUDO
                </span>
              )}

              {hud.activeCheckpoint && (
                <span className="border border-[#07050d] bg-[#2a5c4f] px-1.5 py-0.5 font-pixel text-[10px] font-bold text-[#a6fff0]">
                  CHECKPOINT
                </span>
              )}

              {/* Overdrive / Éter Supremo Gauge */}
              <div
                aria-label={`Éter Supremo: ${hud.overdrive}%`}
                className="flex items-center gap-1 border border-[#07050d] bg-[#140e24] px-1.5 py-0.5"
              >
                <span
                  className={`font-pixel text-[10px] font-bold ${
                    hud.overdriveActive ? 'text-[#ffe066]' : 'text-[#b8afc9]'
                  }`}
                >
                  ÉTER
                </span>
                <div className="h-2 w-14 overflow-hidden border border-[#07050d] bg-[#0a0712]">
                  <div
                    style={{
                      transform: `scaleX(${Math.max(0, Math.min(1, hud.overdrive / 100))})`,
                      transformOrigin: 'left',
                    }}
                    className={`h-full ${
                      hud.overdriveActive ? 'bg-[#ffe066]' : 'bg-[#52e5ff]'
                    }`}
                  />
                </div>
              </div>

              {gamepadName && (
                <span className="border border-[#07050d] bg-[#1a5c49] px-1.5 py-0.5 font-pixel text-[10px] font-bold text-[#8effdb]">
                  CONTROLE
                </span>
              )}

              {/* Duo [F] Swap Readiness Pill */}
              <span
                style={{
                  borderColor: '#07050d',
                  color: hud.tagSwapCooldown <= 0 ? '#09080f' : '#d7cee8',
                  backgroundColor: hud.tagSwapCooldown <= 0 ? '#4df0c0' : '#1c152e',
                }}
                className="border px-1.5 py-0.5 font-pixel text-[10px] font-bold"
              >
                {hud.tagSwapCooldown <= 0
                  ? `[F] ${getHeroDef(hud.tagHeroId).name}`
                  : `[F] ${hud.tagSwapCooldown.toFixed(1)}s`}
              </span>

              {/* Dynamic Room Weather & Spirit Companion Badges */}
              {hud.weather !== 'clear' && (
                <span
                  style={{
                    color: WEATHER_META[hud.weather].color,
                    borderColor: WEATHER_META[hud.weather].color + '99',
                  }}
                  className="border bg-[#120d22] px-1.5 py-0.5 font-pixel text-[10px] font-bold"
                >
                  {hud.weatherName}
                </span>
              )}

              {hud.equippedSpirit !== 'none' && SPIRIT_MAP[hud.equippedSpirit] && (
                <span
                  style={{
                    color: SPIRIT_MAP[hud.equippedSpirit].color,
                    borderColor: SPIRIT_MAP[hud.equippedSpirit].color + '88',
                  }}
                  className="border bg-[#120d22] px-1.5 py-0.5 font-pixel text-[10px] font-bold"
                >
                  {SPIRIT_MAP[hud.equippedSpirit].name}
                </span>
              )}

              {hud.riftActive && (
                <span className="border border-[#07050d] bg-[#4c1d95] px-1.5 py-0.5 font-pixel text-[10px] font-bold text-[#52e5ff]">
                  FENDA {hud.riftProgress}/{hud.riftTotal} · {hud.riftTimer.toFixed(1)}s
                </span>
              )}

              {hud.activeTitle !== 'viajante' && TITLE_MAP[hud.activeTitle] && (
                <span
                  style={{
                    color: TITLE_MAP[hud.activeTitle].color,
                    borderColor: TITLE_MAP[hud.activeTitle].color + '88',
                  }}
                  className="border bg-[#120d22] px-1.5 py-0.5 font-pixel text-[10px] font-bold"
                >
                  {TITLE_MAP[hud.activeTitle].name}
                </span>
              )}

              {hud.imbuedElement && hud.imbuedTimer > 0 && ELEMENT_META[hud.imbuedElement] && (
                <span
                  style={{
                    color: ELEMENT_META[hud.imbuedElement].color,
                    borderColor: ELEMENT_META[hud.imbuedElement].color,
                  }}
                  className="border bg-[#190f2b] px-1.5 py-0.5 font-pixel text-[10px] font-bold"
                >
                  TOTEM {ELEMENT_META[hud.imbuedElement].label} {hud.imbuedTimer.toFixed(1)}s
                </span>
              )}

              {hud.echoCloneActive && (
                <span className="border border-[#07050d] bg-[#1b4965] px-1.5 py-0.5 font-pixel text-[10px] font-bold text-[#88eeff]">
                  ECO ATIVO
                </span>
              )}

              {hud.activeBoons.length > 0 && (
                <span className="border border-[#07050d] bg-[#24163d] px-1.5 py-0.5 font-pixel text-[10px] font-bold text-[#ffd27d]">
                  {hud.activeBoons.length} {hud.activeBoons.length === 1 ? 'Carta' : 'Cartas'}
                </span>
              )}
            </div>

            {/* Chapter · Stage · Room Name & Active Play Mode Status */}
            <div className="flex flex-wrap items-center gap-2 text-stroke-dark font-pixel text-xs text-[#ffd27d]">
              {hud.playMode === 'tower' ? (
                <span
                  data-testid="hud-tower-badge"
                  className="border border-[#07050d] bg-[#0f293d] px-1.5 py-0.5 text-[10px] font-bold text-[#38bdf8]"
                >
                  TORRE · ANDAR {hud.towerFloor} (REC. {hud.bestTowerFloor})
                </span>
              ) : hud.playMode === 'boss_rush' ? (
                <span className="border border-[#07050d] bg-[#732334] px-1.5 py-0.5 text-[10px] font-bold text-[#ffd27d]">
                  RUSH CHEFÕES {hud.bossRushIndex}/{hud.bossRushTotal}
                </span>
              ) : hud.playMode === 'survival' ? (
                <span className="border border-[#07050d] bg-[#1a5c49] px-1.5 py-0.5 text-[10px] font-bold text-[#8effdb]">
                  ONDA {hud.survivalWave} · ABATES {hud.survivalKills}
                </span>
              ) : hud.playMode !== 'campaign' ? (
                <span
                  style={{ color: activeModeDef.accentColor }}
                  className="border border-[#07050d] bg-[#140e24] px-1.5 py-0.5 text-[10px] font-bold"
                >
                  {activeModeDef.name.toUpperCase()}
                </span>
              ) : null}
              <span>
                {hud.playMode === 'tower' ? (
                  <span className="text-[#f5efe6]">{hud.roomName}</span>
                ) : (
                  <>
                    Fase {hud.chapterIndex + 1}/{hud.totalChapters} · Etapa {hud.stageNumber}/
                    {hud.totalStagesInChapter} ·{' '}
                    <span className="text-[#f5efe6]">
                      {hud.roomName.replace(/^Etapa\s+\d+\s*·\s*/i, '')}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Dynamic Boss Pixel HP, Stagger & Weakness Bar (Top Center during Boss Fight) */}
          {hud.bossHp !== null && hud.bossMaxHp && (
            <div data-testid="boss-hud-bar" className="absolute left-1/2 top-28 -translate-x-1/2 pointer-events-none md:top-3">
              <div className="pixel-panel px-3.5 py-1.5 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2 font-pixel text-xs font-bold tracking-wider text-stroke-dark">
                  <span className="text-[#ff5c77]">{hud.bossName ?? 'GUARDIÃO'}</span>
                  {hud.bossPhase === 2 && (
                    <span className="border border-[#07050d] bg-[#9e471b] px-1.5 py-0 text-[10px] text-[#ffe47a]">
                      FASE II
                    </span>
                  )}
                  {hud.bossPhase === 3 && (
                    <span className="border border-[#07050d] bg-[#9e1b3b] px-1.5 py-0 text-[10px] text-[#ffe47a]">
                      FASE III · FÚRIA
                    </span>
                  )}
                  {hud.bossWeakness && ELEMENT_META[hud.bossWeakness] && (
                    <span
                      style={{
                        color: ELEMENT_META[hud.bossWeakness].color,
                        borderColor: ELEMENT_META[hud.bossWeakness].color + '99',
                      }}
                      className="border bg-[#140e24] px-1.5 py-0 text-[10px]"
                    >
                      Fraqueza: {ELEMENT_META[hud.bossWeakness].label}
                    </span>
                  )}
                  {hud.bossSubState === 'staggered' && (
                    <span className="border border-[#07050d] bg-[#ffd24d] px-1.5 py-0 text-[10px] text-[#09080f]">
                      ATORDOADO · DANO x2!
                    </span>
                  )}
                  {hud.bossSubState === 'recover' && (
                    <span className="border border-[#07050d] bg-[#1a5c49] px-1.5 py-0 text-[10px] text-[#8effdb]">
                      VULNERÁVEL
                    </span>
                  )}
                  {hud.bossSubState === 'windup' && (
                    <span className="border border-[#07050d] bg-[#732334] px-1.5 py-0 text-[10px] text-[#ffd27d]">
                      ATAQUE IMINENTE!
                    </span>
                  )}
                  <span className="font-mono-num text-[#ffd27d]">
                    {hud.bossHp}/{hud.bossMaxHp}
                  </span>
                </div>
                {hud.bossTitle && (
                  <div className="font-body-pixel text-[10px] text-[#b8afc9]">{hud.bossTitle}</div>
                )}
                <div className="mt-1 flex items-center justify-center gap-1">
                  {Array.from({ length: hud.bossMaxHp }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2.5 w-6 border border-[#07050d] ${
                        idx < hud.bossHp!
                          ? hud.bossPhase === 3
                            ? 'bg-[#ff2e63]'
                            : hud.bossPhase === 2
                              ? 'bg-[#ff5c33]'
                              : 'bg-[#ff9933]'
                          : 'bg-[#1a1224]'
                      }`}
                    />
                  ))}
                </div>
                {hud.bossStaggerRatio !== null && (
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span className="font-pixel text-[9px] uppercase tracking-wider text-[#ffd24d]">
                      Postura
                    </span>
                    <div className="h-1.5 w-36 overflow-hidden border border-[#07050d] bg-[#120d1e]">
                      <div
                        style={{
                          transform: `scaleX(${Math.max(0, Math.min(1, hud.bossStaggerRatio))})`,
                          transformOrigin: 'left',
                        }}
                        className={`h-full ${
                          hud.bossSubState === 'staggered' ? 'bg-[#ff66dd]' : 'bg-[#ffd24d]'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top-Right Clean Utility Cluster + Redesigned HUD Pause Button */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5 pointer-events-auto sm:right-4 sm:top-3 sm:gap-2">
            <PixelButton
              type="button"
              variant="slate"
              tabIndex={-1}
              data-testid="open-sanctuary-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.setPaused(true);
                setOverlay('sanctuary');
              }}
              aria-label="Abrir Santuário de Runas & Maestria (G)"
              title="Santuário · Runas & Maestria [G]"
              className="h-8 !px-2 !py-0 font-pixel text-xs text-[#52e5ff] sm:h-9 sm:!px-2.5"
            >
              <PixelIcon name="bolt" className="h-3.5 w-3.5 text-[#52e5ff]" />
              <span className="hidden sm:inline">Runas</span>
              <span className="hidden md:inline border border-[#07050d] bg-[#120d21] px-1 py-0 font-mono-num text-[10px] text-[#9ff0ff]">
                G
              </span>
            </PixelButton>

            <PixelButton
              type="button"
              variant="slate"
              tabIndex={-1}
              onClick={handleToggleMute}
              aria-label={hud.muted ? 'Ativar áudio' : 'Silenciar áudio'}
              title="Áudio [N]"
              className="h-8 w-8 !px-0 !py-0 sm:h-9 sm:w-9"
            >
              <PixelIcon
                name={hud.muted ? 'sound_off' : 'sound_on'}
                className={`h-4 w-4 ${hud.muted ? 'text-[#ff708d]' : 'text-[#4df0c0]'}`}
              />
            </PixelButton>

            <PixelButton
              type="button"
              variant="gold"
              tabIndex={-1}
              data-testid="hud-pause-btn"
              onClick={handleTogglePause}
              aria-label="Pausar jogo (Esc)"
              title="Pausar [Esc]"
              className="h-8 !px-2.5 !py-0 font-pixel text-xs sm:h-9 sm:!px-3"
            >
              <PixelIcon name="pause" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-bold tracking-wider">PAUSA</span>
              <span className="hidden md:inline border border-[#07050d] bg-[#1a1326] px-1 py-0 font-mono-num text-[10px] text-[#ffe066]">
                ESC
              </span>
            </PixelButton>
          </div>

          {/* Pixel Biome / Chapter Entry Banner */}
          {hud.bannerTitle && (
            <div className="pointer-events-none absolute inset-x-0 top-40 flex flex-col items-center px-3 text-center sm:top-16">
              <div className="pixel-panel px-4 py-2 sm:px-7 sm:py-3">
                <span className="pointer-events-none absolute left-1 top-1 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <span className="pointer-events-none absolute bottom-1 left-1 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <span className="pointer-events-none absolute bottom-1 right-1 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <div className="font-pixel text-base font-bold tracking-wide text-[#f5efe6] text-stroke-dark sm:text-xl">
                  {hud.bannerTitle}
                </div>
                {hud.bannerSub && (
                  <div className="mt-0.5 font-pixel text-[11px] text-[#ffd27d] sm:text-xs">
                    {hud.bannerSub}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pixel Mechanic Discovery Toast */}
          {hud.recentMechanicToast && (
            <div className="pixel-panel pointer-events-none fixed bottom-32 right-3 max-w-[calc(100vw-24px)] px-3 py-2 text-xs text-[#4df0c0] sm:bottom-4 sm:right-4 sm:px-4 sm:py-2.5">
              <span className="font-pixel uppercase tracking-wider text-[#8effdb]">Descoberta:</span>{' '}
              <strong className="font-pixel text-xs text-[#f5efe6] sm:text-sm">
                {hud.recentMechanicToast}
              </strong>
            </div>
          )}

          {/* Shrine Interaction Floating Prompt */}
          {hud.nearShrine && !hud.dialogue && overlay === 'none' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
              <PixelButton
                type="button"
                variant="gold"
                onClick={(e) => {
                  e.currentTarget.blur();
                  engineRef.current?.setPaused(true);
                  setOverlay('blessings');
                }}
                className="px-4 py-2 text-xs"
              >
                <PixelIcon name="shrine" className="h-4 w-4" />
                <span>[E / B] Abrir Altar de Bênçãos</span>
              </PixelButton>
            </div>
          )}

          {/* Toggleable Pixel Stage Mini-Radar (Bottom-Left) */}
          {!showTouchControls && hud.stageNodes.length > 0 && (
            <div className="absolute bottom-3 left-4 pointer-events-auto">
              {showRadar ? (
                <div className="pixel-panel p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="font-pixel text-[10px] font-bold uppercase tracking-wider text-[#ffd27d]">
                      Radar [Tab]
                    </span>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setShowRadar(false);
                        focusViewport();
                      }}
                      className="font-pixel text-[10px] text-[#b8afc9] hover:text-[#ffffff]"
                    >
                      Ocultar
                    </button>
                  </div>
                  <div
                    style={{
                      gridTemplateColumns: `repeat(${
                        Math.max(...hud.stageNodes.map((n) => n.gx)) + 1
                      }, 14px)`,
                    }}
                    className="grid gap-1"
                  >
                    {(() => {
                      const maxX = Math.max(...hud.stageNodes.map((n) => n.gx));
                      const maxY = Math.max(...hud.stageNodes.map((n) => n.gy));
                      const map = new Map(hud.stageNodes.map((n) => [`${n.gx},${n.gy}`, n]));
                      const cells: React.ReactNode[] = [];
                      for (let y = 0; y <= maxY; y++) {
                        for (let x = 0; x <= maxX; x++) {
                          const node = map.get(`${x},${y}`);
                          if (!node) {
                            cells.push(<div key={`${x},${y}`} className="h-3 w-3.5" />);
                          } else {
                            cells.push(
                              <div
                                key={node.id}
                                title={node.id}
                                className={`h-3 w-3.5 border ${
                                  node.current
                                    ? 'border-[#ffffff] bg-[#52e5ff]'
                                    : node.hasGoal
                                    ? 'border-[#07050d] bg-[#ffd27d]'
                                    : node.visited
                                    ? 'border-[#07050d] bg-[#4df0c0]'
                                    : 'border-[#07050d] bg-[#2a223d]'
                                }`}
                              />
                            );
                          }
                        }
                      }
                      return cells;
                    })()}
                  </div>
                </div>
              ) : (
                <PixelButton
                  type="button"
                  variant="slate"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShowRadar(true);
                    focusViewport();
                  }}
                  className="px-2.5 py-1 text-[10px]"
                >
                  Radar [Tab]
                </PixelButton>
              )}
            </div>
          )}

          {/* Mobile Virtual Analog Joystick + Action Controls ([T]) */}
          {showTouchControls && !hud.dialogue && (
            <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex items-end justify-between px-3 sm:px-6">
              {/* Crisp Square Pixel Virtual Analog Stick */}
              <div
                ref={joyBaseRef}
                data-testid="virtual-joystick"
                aria-label="Joystick Analógico Virtual"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameAudio.unlock();
                  joyPointerIdRef.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateJoystickFromPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (joyPointerIdRef.current === e.pointerId) {
                    updateJoystickFromPointer(e.clientX, e.clientY);
                  }
                }}
                onPointerUp={(e) => {
                  if (joyPointerIdRef.current === e.pointerId) {
                    resetVirtualJoystick();
                  }
                }}
                onPointerCancel={() => resetVirtualJoystick()}
                className="pointer-events-auto relative flex h-24 w-24 touch-none select-none items-center justify-center border-2 border-[#07050d] bg-[#140e24]/92 shadow-[0_4px_0_0_#07050d] sm:h-28 sm:w-28"
              >
                <span className="pointer-events-none absolute top-1 font-pixel text-[10px] text-[#7c7399]">▲</span>
                <span className="pointer-events-none absolute bottom-1 font-pixel text-[10px] text-[#7c7399]">▼</span>
                <span className="pointer-events-none absolute left-1.5 font-pixel text-[10px] text-[#7c7399]">◄</span>
                <span className="pointer-events-none absolute right-1.5 font-pixel text-[10px] text-[#7c7399]">►</span>
                <div className="pointer-events-none h-9 w-9 border border-[#2f264a] bg-[#0c0818] sm:h-10 sm:w-10" />
                <div
                  ref={joyKnobRef}
                  data-testid="virtual-joystick-knob"
                  className="pointer-events-none absolute h-9 w-9 border-2 border-[#07050d] bg-[#52e5ff] shadow-[0_3px_0_0_#1e6478] sm:h-11 sm:w-11"
                />
              </div>

              <div className="pointer-events-auto flex flex-col items-end gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onPointerDown={() => setVirtualKey('swap', true)}
                    onPointerUp={() => setVirtualKey('swap', false)}
                    onPointerCancel={() => setVirtualKey('swap', false)}
                    className="pixel-btn h-8 px-2 bg-[#194a41]/92 font-pixel text-[10px] font-bold text-[#8effdb] sm:h-10 sm:px-2.5 sm:text-[11px]"
                  >
                    [F] DUPLA
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => setVirtualKey('interact', true)}
                    onPointerUp={() => setVirtualKey('interact', false)}
                    onPointerCancel={() => setVirtualKey('interact', false)}
                    className="pixel-btn h-8 px-2 bg-[#3a2812]/92 font-pixel text-[10px] font-bold text-[#ffd27d] sm:h-10 sm:px-2.5 sm:text-[11px]"
                  >
                    [E]
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => setVirtualKey('skill', true)}
                    onPointerUp={() => setVirtualKey('skill', false)}
                    onPointerCancel={() => setVirtualKey('skill', false)}
                    className="pixel-btn h-8 px-2.5 bg-[#4c2463]/92 font-pixel text-[11px] font-bold text-[#ff88dd] sm:h-10 sm:px-3 sm:text-xs"
                  >
                    [Q]
                  </button>
                </div>

                <div className="flex items-end gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onPointerDown={() => setVirtualKey('grab', true)}
                    onPointerUp={() => setVirtualKey('grab', false)}
                    onPointerCancel={() => setVirtualKey('grab', false)}
                    className="pixel-btn h-11 px-2 bg-[#1a5c49]/92 font-pixel text-[11px] font-bold text-[#8effdb] sm:h-12 sm:px-3 sm:text-xs"
                  >
                    ESCALAR
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => setVirtualKey('dash', true)}
                    onPointerUp={() => setVirtualKey('dash', false)}
                    onPointerCancel={() => setVirtualKey('dash', false)}
                    className="pixel-btn h-12 px-2.5 bg-[#2a4a6e]/92 font-pixel text-xs font-bold text-[#9ff0ff] sm:h-14 sm:px-4 sm:text-sm"
                  >
                    DASH
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => setVirtualKey('jump', true)}
                    onPointerUp={() => setVirtualKey('jump', false)}
                    onPointerCancel={() => setVirtualKey('jump', false)}
                    className="pixel-btn h-12 px-3 bg-[#e8a87c]/95 font-pixel text-xs font-bold text-[#09080f] sm:h-14 sm:px-4 sm:text-sm"
                  >
                    PULAR
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pixel NPC Dialogue Box */}
          {hud.dialogue && (
            <div className="absolute inset-x-0 bottom-5 mx-auto max-w-2xl px-4 pointer-events-auto">
              <div className="pixel-panel p-5">
                <span className="pointer-events-none absolute left-1.5 top-1.5 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <span className="pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />
                <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-1.5 w-1.5 bg-[#ffd27d]" aria-hidden="true" />

                <div
                  style={{ borderBottomColor: hud.dialogue.accentColor }}
                  className="flex items-baseline justify-between gap-2 border-b-2 pb-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      style={{ color: hud.dialogue.accentColor }}
                      className="font-pixel text-xl font-bold text-stroke-dark"
                    >
                      {hud.dialogue.speaker}
                    </span>
                    <span className="font-pixel text-xs text-[#b8afc9]">
                      · {hud.dialogue.role}
                    </span>
                  </div>
                  <span className="font-mono-num text-[11px] text-[#ffd27d]">[E / Espaço]</span>
                </div>

                <p className="mt-3 min-h-[3.2rem] font-body-pixel text-sm leading-relaxed text-[#f5efe6]">
                  {(
                    hud.dialogue.replyText ??
                    hud.dialogue.lines[hud.dialogue.lineIndex]
                  ).slice(0, Math.floor(hud.dialogue.charIndex || 999))}
                </p>

                {!hud.dialogue.replyText &&
                  hud.dialogue.lineIndex === hud.dialogue.lines.length - 1 &&
                  hud.dialogue.choices && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hud.dialogue.choices.map((ch, idx) => (
                        <PixelButton
                          key={ch.label}
                          type="button"
                          variant="cyan"
                          onClick={() => engineRef.current?.advanceDialogue(idx)}
                          className="px-3 py-1.5 text-xs"
                        >
                          {ch.label}
                        </PixelButton>
                      ))}
                    </div>
                  )}

                <div className="mt-4 flex justify-end">
                  <PixelButton
                    type="button"
                    variant="gold"
                    onClick={() => engineRef.current?.advanceDialogue()}
                    className="px-4 py-1.5 text-xs"
                  >
                    {hud.dialogue.replyText ||
                    (hud.dialogue.lineIndex === hud.dialogue.lines.length - 1 &&
                      !hud.dialogue.choices)
                      ? 'Fechar'
                      : 'Continuar'}
                  </PixelButton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPACT ORGANIZED PIXEL PAUSE MODAL */}
      {hud?.mode === 'paused' && overlay === 'none' && (
        <PauseModal
          hud={hud}
          totalMechanics={TOTAL_MECHANICS}
          totalChronicles={LORE_CODEX.length}
          gamepadName={gamepadName}
          showRadar={showRadar}
          showTouchControls={showTouchControls}
          onResume={() => {
            setOverlay('none');
            engineRef.current?.setPaused(false);
            focusViewport();
          }}
          onRestartChapter={() => {
            setOverlay('none');
            engineRef.current?.replayChapter();
            focusViewport();
          }}
          onReturnTitle={() => {
            setOverlay('none');
            engineRef.current?.returnToTitle();
          }}
          onToggleMute={() => {
            gameAudio.toggleMute();
            engineRef.current?.emitHud();
          }}
          onOpenOverlay={(target) => setOverlay(target)}
          onCycleGameSpeed={() => {
            const eng = engineRef.current;
            if (!eng) return;
            const speeds: (1 | 0.8 | 0.6)[] = [1, 0.8, 0.6];
            const next = speeds[(speeds.indexOf(eng.assist.gameSpeed) + 1) % speeds.length];
            eng.assist.gameSpeed = next;
            eng.unlockMechanic('ASSIST_MODE');
            eng.emitHud();
          }}
          onToggleAssist={(key) => {
            const eng = engineRef.current;
            if (!eng) return;
            eng.assist[key] = !eng.assist[key];
            if (key === 'hardcoreMode') {
              eng.unlockMechanic('HARDCORE_MODE');
            } else if (key === 'infiniteStamina' || key === 'extraDash') {
              eng.unlockMechanic('ASSIST_MODE');
            }
            eng.emitHud();
          }}
          onToggleRadar={() => setShowRadar((v) => !v)}
          onToggleTouch={() => {
            touchManualRef.current = true;
            setShowTouchControls((v) => !v);
          }}
        />
      )}

      {/* PIXEL STAGE SELECT & INTERNAL STAGES MODAL */}
      {hud && overlay === 'map' && engineRef.current && (
        <StageSelectModal
          hud={hud}
          playMode={hud.playMode}
          chapters={engineRef.current.chapters}
          collectedRelics={engineRef.current.collectedRelics}
          onSelectChapter={(chapterIdx) => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            setOverlay('none');
            engineRef.current?.startChapter(chapterIdx);
          }}
          onFastTravelStage={(stageId) => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            setOverlay('none');
            engineRef.current?.fastTravelToRoom(stageId);
          }}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* PIXEL COMPENDIUM 108 MECHANICS MODAL */}
      {hud && overlay === 'compendium' && engineRef.current && (
        <CompendiumModal
          discoveredCodes={engineRef.current.discoveredMechanics}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* PIXEL HERO SELECT MODAL */}
      {hud && overlay === 'heroes' && engineRef.current && (
        <HeroSelectModal
          activeHeroId={hud.heroId}
          heroSkins={engineRef.current.heroSkinByHero}
          tagHeroId={hud.tagHeroId}
          playerLevel={hud.playerLevel}
          astralCoins={hud.astralCoins}
          unlockedHeroes={hud.unlockedHeroes}
          onUnlockHero={(heroId) => {
            engineRef.current?.unlockHero(heroId);
          }}
          onSelectHero={(heroId, skinId) => {
            const switched = engineRef.current?.setHero(heroId, skinId, true);
            if (!switched) return;
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
          onSelectTagHero={(tagId) => {
            engineRef.current?.setTagHero(tagId, true);
          }}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* PIXEL LOADOUT SANCTUARY MODAL (RUNAS, ESPÍRITOS, DUPLA, MAESTRIA, CONQUISTAS, FANTASMA) */}
      {hud && overlay === 'sanctuary' && engineRef.current && (
        <LoadoutSanctuaryModal
          engine={engineRef.current}
          hud={hud}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* PIXEL BLESSING ALTAR MODAL */}
      {hud && overlay === 'blessings' && engineRef.current && (
        <BlessingShopModal
          coins={hud.astralCoins}
          blessings={hud.blessings}
          onBuy={(key) => {
            engineRef.current?.buyBlessingUpgrade(key);
          }}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* PIXEL CHRONICLES & CUTSCENE THEATER MODAL */}
      {hud && overlay === 'chronicles' && engineRef.current && (
        <ChroniclesModal
          seenCutscenes={hud.seenCutscenes}
          onPlayCutscene={(id) => {
            setOverlay('none');
            engineRef.current?.triggerCutscene(id, true);
          }}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* PIXEL PLAY MODES MODAL */}
      {hud && overlay === 'modes' && engineRef.current && (
        <ModeSelectModal
          activeMode={hud.playMode}
          bestSurvivalWave={hud.bestSurvivalWave}
          bestBossRushSeconds={hud.bestBossRushSeconds}
          bestTowerFloor={hud.bestTowerFloor}
          onSelectMode={(modeId) => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            setOverlay('none');
            engineRef.current?.startPlayMode(modeId, true);
            focusViewport();
          }}
          onClose={() => {
            setOverlay('none');
            if (engineRef.current?.mode === 'paused') {
              engineRef.current.setPaused(false);
            }
          }}
        />
      )}

      {/* ANIMATED PIXEL-ART STORY CUTSCENE OVERLAY */}
      {hud?.activeCutscene && (
        <CutsceneOverlay
          cutsceneId={hud.activeCutscene}
          heroId={hud.heroId}
          skinId={hud.heroSkinId}
          gamepadConfirmTick={gamepadConfirmTick}
          gamepadSkipTick={gamepadSkipTick}
          onFinish={() => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            engineRef.current?.finishCutscene();
            focusViewport();
          }}
        />
      )}

      {/* ASTRAL BOON DRAFT MODAL (ROGUELITE 3-CARD SELECTION) */}
      {hud?.pendingBoonChoices && hud.pendingBoonChoices.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Escolha uma Carta Astral"
          data-testid="boon-draft-modal"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#05040a]/85 p-4 pointer-events-auto"
        >
          <PixelWindow
            title="Altar das Cartas Astrais"
            subtitle="Escolha 1 bênção tática para potencializar sua jornada"
            accentColor="#ffe066"
            maxWidthClass="max-w-3xl"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {hud.pendingBoonChoices.map((boonId) => {
                const boon = BOON_MAP[boonId];
                if (!boon) return null;
                return (
                  <button
                    key={boon.id}
                    type="button"
                    data-testid={`boon-choice-${boon.id}`}
                    onClick={() => {
                      keysHeld.current.clear();
                      keysJustPressed.current.clear();
                      touchHeld.current = {};
                      touchJustPressed.current = {};
                      engineRef.current?.chooseBoon(boon.id);
                      focusViewport();
                    }}
                    style={{ borderColor: boon.color }}
                    className="pixel-subpanel flex flex-col justify-between gap-3 p-3.5 text-left transition-transform hover:-translate-y-0.5 hover:bg-[#1e1535]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          style={{
                            color: '#09080f',
                            backgroundColor: boon.color,
                          }}
                          className="border border-[#07050d] px-1.5 py-0.5 font-pixel text-[10px] font-bold uppercase"
                        >
                          {boon.rarity}
                        </span>
                        <PixelIcon name="gem" className="h-4 w-4 text-[#ffe066]" />
                      </div>
                      <h3
                        style={{ color: boon.color }}
                        className="mt-2 font-pixel text-base font-bold text-stroke-dark"
                      >
                        {boon.name}
                      </h3>
                      <p className="mt-1.5 font-body-pixel text-xs leading-relaxed text-[#e5def2]">
                        {boon.desc}
                      </p>
                    </div>
                    <div className="border-t border-[#2c2246] pt-2 font-pixel text-xs font-bold text-[#ffd27d]">
                      EQUIPAR CARTA &gt;
                    </div>
                  </button>
                );
              })}
            </div>
          </PixelWindow>
        </div>
      )}

      {/* PIXEL VICTORY MODAL (Stage Clear & Final Victory) */}
      {(hud?.mode === 'stage_clear' || (hud?.mode === 'gameover' && hud.victory)) && overlay === 'none' && (
        <VictoryModal
          hud={hud}
          isFinalVictory={hud.mode === 'gameover' && hud.victory}
          onNextChapter={() => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            engineRef.current?.nextChapter();
            focusViewport();
          }}
          onReplayChapter={() => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            engineRef.current?.replayChapter();
            focusViewport();
          }}
          onOpenStages={() => setOverlay('map')}
          onReplayFull={() => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            if (hud.playMode === 'boss_rush' || hud.playMode === 'survival' || hud.playMode === 'tower') {
              engineRef.current?.startPlayMode(hud.playMode, true);
            } else {
              handleRestartFull();
            }
          }}
          onReturnTitle={() => engineRef.current?.returnToTitle()}
        />
      )}

      {/* PIXEL DEFEAT / SURVIVAL / TOWER / IRONMAN GAMEOVER MODAL */}
      {hud?.mode === 'gameover' && !hud.victory && overlay === 'none' && (
        <DefeatModal
          hud={hud}
          onRetry={() => {
            keysHeld.current.clear();
            keysJustPressed.current.clear();
            if (hud.playMode === 'boss_rush' || hud.playMode === 'survival' || hud.playMode === 'tower') {
              engineRef.current?.startPlayMode(hud.playMode, true);
            } else {
              handleRestartFull();
            }
            focusViewport();
          }}
          onOpenStages={() => setOverlay('map')}
          onReturnTitle={() => engineRef.current?.returnToTitle()}
        />
      )}
    </div>
  );
};
