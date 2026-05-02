/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameController } from './game/GameController';
import { GAME_VERSION } from './constants';
import { Alignment, Phase, GameState, HoveredCardInfo } from './types';
import { cardArtUrl } from './cardArtPaths';
import type { EnvironmentTheme } from './theme';
import { THEME_STORAGE_KEY } from './theme';
import { GameOverAchievements } from './components/GameOverAchievements';

function loadStoredTheme(): EnvironmentTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameController | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSelection, setShowSelection] = useState(true);
  const [zoneSearchModal, setZoneSearchModal] = useState<'limbo' | 'graveyard' | 'deck' | null>(null);
  const [logMinimized, setLogMinimized] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(max-width: 1023px)').matches ||
      window.matchMedia('(max-height: 560px)').matches
    );
  });
  const logScrollRef = useRef<HTMLDivElement>(null);
  const [environmentTheme, setEnvironmentTheme] = useState<EnvironmentTheme>(loadStoredTheme);

  const LOG_RECENT_COUNT = 20;
  const displayLogs =
    gameState?.currentPhase === Phase.GAME_OVER
      ? gameState.logs
      : (gameState?.logs ?? []).slice(-LOG_RECENT_COUNT);

  useEffect(() => {
    if (displayLogs.length && logScrollRef.current && !logMinimized) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [displayLogs.length, logMinimized]);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      const game = new GameController(containerRef.current);
      game.onStateChange = (state) => setGameState({ ...state });
      gameRef.current = game;
    }

    return () => {
      gameRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = environmentTheme;
    gameRef.current?.setEnvironmentTheme(environmentTheme);
  }, [environmentTheme]);

  const toggleEnvironmentTheme = () => {
    setEnvironmentTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleSelectAlignment = (side: Alignment) => {
    setShowSelection(false);
    gameRef.current?.selectAlignment(side);
  };

  const handleEndPrep = () => {
    gameRef.current?.endPrep();
  };

  const handlePrepBack = () => {
    gameRef.current?.undoLastPrepAction();
  };

  const handleFinishCounters = () => {
    gameRef.current?.finishCounters();
  };

  const handleDecision = (confirmed: boolean) => {
    if (gameRef.current) {
      (gameRef.current as any).nullifyCallback?.(confirmed);
      (gameRef.current as any).nullifyCallback = null;
    }
  };

  const handleMarkerTypeChoice = (type: 'power' | 'weakness') => {
    if (gameRef.current) {
      (gameRef.current as any).markerTypeCallback?.(type);
      (gameRef.current as any).markerTypeCallback = null;
    }
  };

  const handleForceSkip = () => {
    gameRef.current?.forceSkip();
  };

  return (
    <div className="relative w-full min-h-dvh overflow-hidden font-cinzel box-border pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      {/* Environment theme toggle (accessibility) — bottom-left for less clutter */}
      {/* Theme: desktop bottom-left; mobile top-center so it clears ENEMY/YOU corners. */}
      <button
        type="button"
        onClick={toggleEnvironmentTheme}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-[100] min-h-11 min-w-11 rounded-lg glass-panel touch-manipulation border border-white/20 p-2 transition-all hover:border-[#00f2ff]/60 focus:outline-none focus:ring-2 focus:ring-[#00f2ff]/60 active:opacity-90 hud-compact:bottom-auto hud-compact:left-1/2 hud-compact:right-auto hud-compact:top-[max(0.35rem,env(safe-area-inset-top))] hud-compact:-translate-x-1/2 desktop-hud:translate-x-0"
        title={environmentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={environmentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="text-xl" aria-hidden>
          {environmentTheme === 'dark' ? '☀' : '☽'}
        </span>
      </button>

      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Tap outside to dismiss log (mobile bottom sheet) — below HUD z-10 so transparent HUD areas receive the dimmer */}
      {gameState && !showSelection && gameState.currentPhase !== Phase.GAME_OVER && !logMinimized && (
        <button
          type="button"
          className="fixed inset-0 z-[8] cursor-default touch-manipulation bg-black/45 backdrop-blur-[1px] desktop-hud:hidden"
          aria-label="Dismiss interaction log"
          onClick={() => setLogMinimized(true)}
        />
      )}

      {/* Counter Overlay */}
      <AnimatePresence>
        {gameState?.currentPhase === Phase.COUNTER_ALLOCATION && (
          <motion.div
            initial={{ opacity: 0, x: -40, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -40, y: 0 }}
            className="glass-panel pointer-events-auto absolute top-1/2 left-[max(1rem,env(safe-area-inset-left))] z-50 w-[min(16rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] -translate-y-1/2 space-y-2 rounded-lg border border-[#00f2ff]/40 bg-black/70 px-3 py-3 text-left shadow-[0_0_20px_rgba(0,242,255,0.35)] sm:min-w-[180px] sm:px-4 hud-compact:left-1/2 hud-compact:top-[max(5.75rem,calc(env(safe-area-inset-top)+5rem))] hud-compact:w-[min(18rem,calc(100vw-2rem))] hud-compact:-translate-x-1/2 hud-compact:translate-y-0 touch-manipulation"
          >
            <div className="text-[0.6rem] tracking-[0.2em] uppercase text-gray-400">
              Allocate Counters
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.6rem] text-gray-500 uppercase">Power</span>
                <span className="text-xl text-[#00f2ff] font-bold">{gameState.powerPool}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.6rem] text-gray-500 uppercase">Weakness</span>
                <span className="text-xl text-[#ff0044] font-bold">{gameState.weaknessPool}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFinishCounters}
              className="mt-2 min-h-10 w-full touch-manipulation border border-white/15 bg-white/5 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-widest transition-all hover:border-[#00f2ff] hover:text-[#00f2ff] active:opacity-90 sm:mt-1 sm:w-auto sm:py-1"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delta +3 target overlay (after sacrifice; camera is zoomed out) */}
      <AnimatePresence>
        {gameState?.currentPhase === Phase.DELTA_BUFF_TARGETING && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-24 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-[#00f2ff]/40 bg-black/80 px-5 py-3 text-center pointer-events-none hud-compact:top-[max(6.75rem,calc(env(safe-area-inset-top)+5.75rem))] hud-compact:px-4 glass-panel sm:px-6 sm:py-4"
          >
            <div className="text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-1">Delta&apos;s sacrifice</div>
            <div className="text-sm text-[#00f2ff] font-semibold">+3 Power — click a creature</div>
            <div className="text-[0.65rem] text-gray-500 mt-1">{gameState.instructionText}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection Overlay */}
      <AnimatePresence>
        {showSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex max-h-dvh flex-col items-center justify-start overflow-y-auto overscroll-contain env-bg px-4 pb-10 pt-[max(3.5rem,env(safe-area-inset-top)+3rem)] text-white [touch-action:pan-y] sm:justify-center sm:py-12 sm:pt-12"
          >
            <h1 className="mb-3 text-center text-3xl tracking-[0.25em] sm:mb-4 sm:text-5xl sm:tracking-[10px]">ENDLESS SEVEN</h1>
            <p className="mb-8 max-w-md text-center text-sm italic text-gray-500 sm:mb-12 sm:text-base">&quot;Choose your side. Seal the heartbeat of the world.&quot;</p>
            
            <div className="flex flex-col gap-4 px-4 sm:flex-row sm:gap-8 md:gap-12">
              <AlignmentCard
                side={Alignment.LIGHT}
                title="LIGHT"
                description="Command Celestials and Lycans. Purify the Seals to restore the path of Harmony."
                icon="☼"
                color="#00f2ff"
                onClick={() => handleSelectAlignment(Alignment.LIGHT)}
              />
              <AlignmentCard
                side={Alignment.DARK}
                title="DARKNESS"
                description="Lead Daemons and Vampyres. Corrupt the Seals to usher in the Great Void."
                icon="☾"
                color="#ff0044"
                onClick={() => handleSelectAlignment(Alignment.DARK)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD (hidden during Game Over) */}
      {gameState && !showSelection && gameState.currentPhase !== Phase.GAME_OVER && (
        <div
          className={`absolute inset-0 z-10 flex flex-col justify-between pointer-events-none ${!logMinimized ? 'hud-compact:pb-[min(30vh,220px)]' : ''}`}
        >
          {/* Top Bar — grid on small screens: scores row + full-width command; avoids covering the board */}
          <div className="hud-gradient-top pointer-events-auto px-2 pt-2 pb-2 landscape-short:py-1 landscape-short:pb-1 sm:px-3 desktop-hud:p-6">
            <div className="grid w-full grid-cols-2 gap-x-2 gap-y-2 landscape-short:gap-x-1.5 landscape-short:gap-y-1 desktop-hud:grid-cols-[minmax(0,auto)_1fr_minmax(0,auto)] desktop-hud:gap-x-6 desktop-hud:items-start">
              <div
                className={`min-w-0 rounded-lg glass-panel p-2 sm:p-3 desktop-hud:col-start-1 desktop-hud:row-start-1 desktop-hud:min-w-[150px] desktop-hud:p-4 ${gameState.playerAlignment === Alignment.LIGHT ? 'dark-glow' : 'light-glow'}`}
              >
                <div className="text-[0.55rem] sm:text-[0.7rem] text-[#ff0044]">ENEMY</div>
                <div className="text-xl sm:text-2xl desktop-hud:text-3xl tabular-nums leading-tight">{gameState.enemyScore} / 7</div>
                <div className="mt-0.5 flex justify-between gap-1 text-[0.5rem] text-gray-400 sm:text-[0.6rem] desktop-hud:mt-1">
                  <span className="truncate"><span className="lg:hidden">D:</span><span className="hidden desktop-hud:inline">DECK: </span>{gameState.enemyDeckCount}</span>
                  <span className="truncate"><span className="lg:hidden">G:</span><span className="hidden desktop-hud:inline">GRAVE: </span>{gameState.enemyGraveyardCount}</span>
                </div>
              </div>

              <div
                className={`min-w-0 justify-self-end rounded-lg glass-panel p-2 text-right sm:p-3 desktop-hud:col-start-3 desktop-hud:row-start-1 desktop-hud:justify-self-auto desktop-hud:p-4 ${gameState.playerAlignment === Alignment.LIGHT ? 'light-glow' : 'dark-glow'}`}
              >
                <div className="text-[0.55rem] sm:text-[0.7rem] text-[#00f2ff]">YOU</div>
                <div className="text-xl sm:text-2xl desktop-hud:text-3xl tabular-nums leading-tight">{gameState.playerScore} / 7</div>
                <div className="mt-0.5 flex justify-between gap-1 text-[0.5rem] text-gray-400 sm:text-[0.6rem] desktop-hud:mt-1">
                  <span className="truncate"><span className="lg:hidden">G:</span><span className="hidden desktop-hud:inline">GRAVE: </span>{gameState.playerGraveyardCount}</span>
                  <span className="truncate"><span className="lg:hidden">D:</span><span className="hidden desktop-hud:inline">DECK: </span>{gameState.playerDeckCount}</span>
                </div>
              </div>

              <div className="col-span-2 flex min-w-0 flex-col items-stretch gap-1.5 desktop-hud:col-span-1 desktop-hud:col-start-2 desktop-hud:row-start-1 desktop-hud:items-center desktop-hud:gap-2">
                <div className="glass-panel flex flex-col gap-2 rounded-b-xl border-t-0 px-2 py-1.5 sm:px-4 sm:py-2 desktop-hud:flex-row desktop-hud:items-center desktop-hud:gap-6 desktop-hud:px-6">
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:gap-3">
                    <div className="text-center shrink-0">
                      <div className="text-sm text-white sm:text-base desktop-hud:text-lg">ROUND {gameState.currentRound}</div>
                      <div className="text-[0.5rem] uppercase tracking-widest text-gray-500 sm:text-[0.6rem]">Awaiting Command</div>
                    </div>
                    <div className="flex max-w-full flex-wrap justify-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setZoneSearchModal('limbo')}
                        className="touch-manipulation border border-white/20 bg-white/5 px-1.5 py-1 text-[0.5rem] font-semibold uppercase tracking-widest transition-all hover:border-[#00f2ff]/60 hover:text-[#00f2ff] active:scale-[0.98] active:opacity-90 hud-compact:min-h-10 hud-compact:px-2.5 hud-compact:py-2 sm:px-2.5 sm:py-1.5 sm:text-[0.55rem] desktop-hud:min-h-0 desktop-hud:px-3 desktop-hud:text-[0.6rem]"
                      >
                        <span className="hidden desktop-hud:inline">Search </span>Limbo
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneSearchModal('graveyard')}
                        className="touch-manipulation border border-white/20 bg-white/5 px-1.5 py-1 text-[0.5rem] font-semibold uppercase tracking-widest transition-all hover:border-[#00f2ff]/60 hover:text-[#00f2ff] active:scale-[0.98] active:opacity-90 hud-compact:min-h-10 hud-compact:px-2.5 hud-compact:py-2 sm:px-2.5 sm:py-1.5 sm:text-[0.55rem] desktop-hud:min-h-0 desktop-hud:px-3 desktop-hud:text-[0.6rem]"
                      >
                        <span className="hidden desktop-hud:inline">Search </span>
                        <span className="lg:hidden">Grave</span>
                        <span className="hidden desktop-hud:inline">Graveyard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneSearchModal('deck')}
                        className="touch-manipulation border border-white/20 bg-white/5 px-1.5 py-1 text-[0.5rem] font-semibold uppercase tracking-widest transition-all hover:border-[#00f2ff]/60 hover:text-[#00f2ff] active:scale-[0.98] active:opacity-90 hud-compact:min-h-10 hud-compact:px-2.5 hud-compact:py-2 sm:px-2.5 sm:py-1.5 sm:text-[0.55rem] desktop-hud:min-h-0 desktop-hud:px-3 desktop-hud:text-[0.6rem]"
                      >
                        <span className="hidden desktop-hud:inline">Search </span>Deck
                      </button>
                    </div>
                  </div>
                  <div className="hidden h-8 w-px shrink-0 bg-white/20 desktop-hud:block" />
                  <div className="min-w-0 text-center desktop-hud:min-w-[150px]">
                    <div className="text-sm uppercase tracking-widest text-white sm:text-base desktop-hud:text-xl">
                      {gameState.currentPhase.replace('_', ' ')}
                    </div>
                    <div className="text-[0.55rem] font-bold uppercase tracking-widest text-[#00f2ff] sm:text-[0.65rem]">{gameState.phaseStep}</div>
                  </div>
                </div>
                {gameState.currentPhase === Phase.PREP && (
                  <div className="hidden flex-wrap items-center justify-center gap-2 pointer-events-auto desktop-hud:flex">
                    <button
                      type="button"
                      onClick={handlePrepBack}
                      disabled={!gameRef.current?.canUndoPrep()}
                      className="border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all hover:border-amber-400/80 hover:text-amber-200 disabled:pointer-events-none disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:text-inherit"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleEndPrep}
                      className="border border-white/20 bg-white/5 px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all hover:border-[#00f2ff] hover:text-[#00f2ff]"
                    >
                      End Prep Phase
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="hud-gradient-bottom pointer-events-auto flex flex-col items-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 landscape-short:pt-1 landscape-short:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4 desktop-hud:p-8">
            {gameState.currentPhase === Phase.PREP && (
              <div className="pointer-events-auto mb-2 flex w-full max-w-md flex-wrap justify-center gap-2 desktop-hud:hidden">
                <button
                  type="button"
                  onClick={handlePrepBack}
                  disabled={!gameRef.current?.canUndoPrep()}
                  className="touch-manipulation min-h-11 min-w-[6.25rem] border border-white/20 bg-white/5 px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest transition-all hover:border-amber-400/80 hover:text-amber-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleEndPrep}
                  className="touch-manipulation min-h-11 border border-white/20 bg-white/5 px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest transition-all hover:border-[#00f2ff] hover:text-[#00f2ff] active:scale-[0.98]"
                >
                  End Prep
                </button>
              </div>
            )}
            <div className="mb-2 max-w-[min(42rem,100%)] px-1 text-center text-xs text-gray-300 italic sm:text-sm desktop-hud:mb-4">
              {gameState.instructionText}
            </div>
            {gameState.hoveredZone && (
              <div className="text-[0.7rem] text-[#00f2ff]/90 uppercase tracking-wider mb-2">
                {gameState.hoveredZone.zone === 'playerLimbo' || gameState.hoveredZone.zone === 'enemyLimbo'
                  ? 'Limbo'
                  : 'Graveyard'}
                : {gameState.hoveredZone.count} card{gameState.hoveredZone.count !== 1 ? 's' : ''}
              </div>
            )}
            {gameState.currentPhase === Phase.PREP && (
              <div className="text-center text-[0.6rem] uppercase tracking-wider text-gray-500 sm:text-[0.65rem]">
                Tap a card in your Limbo to use its ability (e.g. Martyr, Saint Michael).
              </div>
            )}
          </div>

          {/* Interaction log: side rail on desktop; bottom sheet on small screens so the board stays visible */}
          {logMinimized ? (
            <button
              type="button"
              onClick={() => setLogMinimized(false)}
              className="pointer-events-auto absolute right-0 top-1/2 z-[25] flex h-24 w-11 min-h-11 min-w-11 -translate-y-1/2 touch-manipulation flex-col items-center justify-center gap-1 border-l border-white/10 bg-black/50 backdrop-blur-md transition-colors hover:bg-black/65 active:scale-[0.98] hud-compact:right-[max(0.5rem,env(safe-area-inset-right))] hud-compact:top-auto hud-compact:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] hud-compact:h-12 hud-compact:min-h-12 hud-compact:w-14 hud-compact:min-w-14 hud-compact:translate-y-0 hud-compact:flex-row hud-compact:rounded-lg hud-compact:border hud-compact:border-white/15 desktop-hud:max-xl:h-20"
              title="Expand interaction log"
              aria-expanded="false"
            >
              <span className="text-[0.5rem] uppercase tracking-widest text-gray-500 [writing-mode:vertical] rotate-180 hud-compact:[writing-mode:horizontal] hud-compact:rotate-0">
                Log
              </span>
              <span className="text-[0.55rem] text-[#00f2ff]/80">{gameState.logs.length}</span>
            </button>
          ) : (
            <div className="pointer-events-auto absolute right-0 top-1/2 z-[25] flex h-[60vh] w-72 max-w-[min(18rem,92vw)] -translate-y-1/2 flex-col overflow-hidden border-l border-white/10 bg-black/50 p-0 backdrop-blur-md hud-compact:left-[max(0.5rem,env(safe-area-inset-left))] hud-compact:right-[max(0.5rem,env(safe-area-inset-right))] hud-compact:top-auto hud-compact:bottom-0 hud-compact:h-[min(36vh,272px)] hud-compact:max-h-[min(320px,40dvh)] hud-compact:w-auto hud-compact:max-w-none hud-compact:translate-y-0 hud-compact:rounded-t-2xl hud-compact:border hud-compact:border-white/15 hud-compact:border-b-0 hud-compact:pb-[env(safe-area-inset-bottom,0px)] hud-compact:shadow-[0_-8px_32px_rgba(0,0,0,0.45)] desktop-hud:border-l desktop-hud:p-3 desktop-hud:max-xl:w-64 desktop-hud:max-xl:text-[0.65rem] desktop-hud:rounded-none">
              <div className="flex shrink-0 flex-col border-b border-white/10 desktop-hud:hidden">
                <div className="mx-auto mb-2 mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25" aria-hidden />
                <div className="flex items-center justify-between gap-2 px-3 pb-2">
                  <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest">Interaction Log</span>
                  <button
                    type="button"
                    onClick={() => setLogMinimized(true)}
                    className="touch-manipulation min-h-11 min-w-11 rounded-md p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100 active:opacity-90"
                    title="Collapse log"
                    aria-label="Collapse interaction log"
                    aria-expanded="true"
                  >
                    <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-2 desktop-hud:flex">
                <span className="text-[0.6rem] text-gray-500 uppercase tracking-widest">Interaction Log</span>
                <button
                  type="button"
                  onClick={() => setLogMinimized(true)}
                  className="touch-manipulation min-h-9 min-w-9 rounded p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300"
                  title="Minimize log"
                  aria-label="Minimize log"
                  aria-expanded="true"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div ref={logScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-2 [touch-action:pan-y] scrollbar-thin sm:pr-2 desktop-hud:px-0">
                {displayLogs.map((log, i) => {
                  const globalIndex = gameState?.currentPhase === Phase.GAME_OVER ? i : (gameState?.logs?.length ?? 0) - displayLogs.length + i;
                  return (
                    <motion.div
                      key={`log-${globalIndex}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[0.7rem] leading-relaxed text-gray-300 font-mono"
                    >
                      <span className="text-[#00f2ff] mr-2">»</span>
                      {log}
                    </motion.div>
                  );
                })}
                <div id="log-bottom" />
              </div>
              {gameState.currentPhase !== Phase.GAME_OVER && gameState.logs.length > LOG_RECENT_COUNT && (
                <div className="mt-1 shrink-0 px-3 text-[0.55rem] text-gray-600 desktop-hud:px-0">
                  Showing last {LOG_RECENT_COUNT} of {gameState.logs.length} · full log at game end
                </div>
              )}
              <button
                type="button"
                onClick={handleForceSkip}
                className="mt-2 shrink-0 touch-manipulation border border-white/10 bg-white/5 px-4 py-3 text-[0.6rem] font-bold uppercase tracking-widest transition-all hover:border-[#ff0044] hover:text-[#ff0044] active:opacity-90 hud-compact:mx-3 hud-compact:mb-3 hud-compact:min-h-12 hud-compact:w-[calc(100%-1.5rem)] desktop-hud:mt-4 desktop-hud:py-2"
              >
                Skip Interaction
              </button>
            </div>
          )}

          {/* Small-screen only: magnified card preview over the log when hovering a card */}
          {gameState.hoveredCard && (
            <CardPreviewOverlay card={gameState.hoveredCard} />
          )}
        </div>
      )}

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameState?.currentPhase === Phase.GAME_OVER && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[100] flex flex-col bg-black/92 backdrop-blur-md hud-compact:overflow-y-auto desktop-hud:overflow-hidden p-3 sm:p-5"
          >
            <header className="shrink-0 text-center max-w-4xl mx-auto w-full pb-3 border-b border-white/5">
              <h1 className="text-2xl sm:text-4xl md:text-5xl tracking-[0.15em] sm:tracking-[0.25em]">
                THE CYCLE ENDS
              </h1>
              {gameState.gameOverResult === 'player' && (
                <p className="text-[0.55rem] uppercase tracking-[0.35em] text-[#00f2ff]/85 mt-2">Victory</p>
              )}
              {gameState.gameOverResult === 'enemy' && (
                <p className="text-[0.55rem] uppercase tracking-[0.35em] text-[#ff0044]/85 mt-2">Defeat</p>
              )}
              {gameState.gameOverResult === 'draw' && (
                <p className="text-[0.55rem] uppercase tracking-[0.35em] text-gray-400 mt-2">Stalemate</p>
              )}
              <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto mt-2 leading-snug px-2">
                {gameState.instructionText}
              </p>
              {gameState.gameOverWinCondition && (
                <p className="text-[0.65rem] sm:text-xs text-[#00f2ff]/90 uppercase tracking-widest mt-2 px-2">
                  Win condition: {gameState.gameOverWinCondition}
                </p>
              )}
            </header>

            <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto grid grid-cols-1 desktop-hud:grid-cols-[minmax(260px,34%)_1fr] gap-4 desktop-hud:gap-6 pt-4">
              {/* Left: achievements — full list visible, no internal scroll */}
              <aside className="min-h-0 flex flex-col desktop-hud:pr-2 desktop-hud:overflow-hidden border-b desktop-hud:border-b-0 desktop-hud:border-r border-white/10 pb-4 desktop-hud:pb-0">
                {gameState.gameOverResult && (
                  <GameOverAchievements
                    result={gameState.gameOverResult}
                    gameOverStats={gameState.gameOverStats}
                    newThisSession={gameState.gameOverNewAchievements ?? []}
                    className="h-full min-h-0"
                  />
                )}
              </aside>

              {/* Right: event log — scrolls with styled bar */}
              <section className="min-h-0 flex flex-col flex-1">
                <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-[#00f2ff]/20 bg-black/50 shadow-[inset_0_1px_0_rgba(0,242,255,0.08)] overflow-hidden">
                  <div className="shrink-0 text-[0.6rem] text-[#00f2ff]/70 uppercase tracking-[0.25em] px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                    Event log
                  </div>
                  <div className="game-over-log-scroll flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-h-[12rem] desktop-hud:min-h-0">
                    {gameState.logs.length > 0 ? (
                      <div className="space-y-1.5">
                        {gameState.logs.map((log, i) => (
                          <div
                            key={i}
                            className="text-[0.68rem] sm:text-[0.7rem] leading-relaxed text-gray-300 font-mono pl-1 border-l-2 border-[#00f2ff]/20 hover:border-[#00f2ff]/45 transition-colors"
                          >
                            <span className="text-[#00f2ff]/80 mr-2 select-none">»</span>
                            {log}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.65rem] text-gray-600 italic">No log entries.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <footer className="shrink-0 flex justify-center pt-4 pb-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-10 sm:px-14 py-2.5 sm:py-3 border border-white/25 hover:border-[#00f2ff] hover:text-[#00f2ff] transition-all text-sm sm:text-base tracking-[0.2em] uppercase font-bold"
              >
                Begin New Cycle
              </button>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decision Dialog (Fallen One, Delta, Luna, The Almighty marker type) */}
      <AnimatePresence>
        {gameState && gameState.currentPhase !== Phase.GAME_OVER && gameState.decisionContext === 'ALMIGHTY_MARKER_TYPE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-panel absolute left-1/2 z-[85] flex max-w-[min(24rem,calc(100vw-1.25rem))] -translate-x-1/2 touch-manipulation flex-col items-center gap-3 border border-[#00f2ff]/40 bg-black/70 px-4 py-4 pointer-events-auto bottom-[max(7rem,calc(env(safe-area-inset-bottom)+5rem))] hud-compact:bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:px-6"
          >
            <div className="text-[0.7rem] text-gray-400 uppercase tracking-widest">The Almighty — Activate</div>
            <div className="text-xs text-gray-200 text-center max-w-xs">
              {gameState.decisionMessage ?? gameState.instructionText}
            </div>
            <div className="flex gap-4 mt-1">
              <button
                onClick={() => handleMarkerTypeChoice('power')}
                className="px-5 py-2 bg-[#00f2ff]/20 border border-[#00f2ff] text-[#00f2ff] hover:bg-[#00f2ff]/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                All Power Markers
              </button>
              <button
                onClick={() => handleMarkerTypeChoice('weakness')}
                className="px-5 py-2 bg-[#ff0044]/20 border border-[#ff0044] text-[#ff4466] hover:bg-[#ff0044]/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                All Weakness Markers
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameState && gameState.currentPhase !== Phase.GAME_OVER && gameState.decisionContext === 'DESTROYER_MARKER_TYPE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-panel absolute left-1/2 z-[85] flex max-w-[min(24rem,calc(100vw-1.25rem))] -translate-x-1/2 touch-manipulation flex-col items-center gap-3 border border-[#00f2ff]/40 bg-black/70 px-4 py-4 pointer-events-auto bottom-[max(7rem,calc(env(safe-area-inset-bottom)+5rem))] hud-compact:bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:px-6"
          >
            <div className="text-[0.7rem] text-gray-400 uppercase tracking-widest">The Destroyer — Activate</div>
            <div className="text-xs text-gray-200 text-center max-w-xs">
              {gameState.decisionMessage ?? gameState.instructionText}
            </div>
            <div className="flex gap-4 mt-1">
              <button
                onClick={() => handleMarkerTypeChoice('power')}
                className="px-5 py-2 bg-[#00f2ff]/20 border border-[#00f2ff] text-[#00f2ff] hover:bg-[#00f2ff]/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                All Power Markers
              </button>
              <button
                onClick={() => handleMarkerTypeChoice('weakness')}
                className="px-5 py-2 bg-[#ff0044]/20 border border-[#ff0044] text-[#ff4466] hover:bg-[#ff0044]/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                All Weakness Markers
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameState && gameState.currentPhase !== Phase.GAME_OVER && gameState.decisionContext === 'DEATH_CREATURE_TYPE' && gameState.creatureTypeOptions && gameState.creatureTypeOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-panel absolute left-1/2 z-[85] flex max-w-[min(24rem,calc(100vw-1.25rem))] -translate-x-1/2 touch-manipulation flex-col items-center gap-3 border border-[#00f2ff]/40 bg-black/70 px-4 py-4 pointer-events-auto bottom-[max(7rem,calc(env(safe-area-inset-bottom)+5rem))] hud-compact:bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:px-6"
          >
            <div className="text-[0.7rem] text-gray-400 uppercase tracking-widest">Death — Flip</div>
            <div className="text-xs text-gray-200 text-center max-w-xs">
              {gameState.decisionMessage ?? gameState.instructionText}
            </div>
            <div className="flex flex-wrap gap-2 mt-1 justify-center">
              {gameState.creatureTypeOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    (gameRef.current as any).creatureTypeCallback?.(t);
                    (gameRef.current as any).creatureTypeCallback = null;
                  }}
                  className="px-4 py-2 bg-[#ff0044]/20 border border-[#ff0044] text-[#ff4466] hover:bg-[#ff0044]/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
                >
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameState && gameState.currentPhase !== Phase.GAME_OVER && gameState.decisionContext === 'LUST_SEAL_INFLUENCE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-panel absolute left-1/2 z-[85] flex max-w-[min(24rem,calc(100vw-1.25rem))] -translate-x-1/2 touch-manipulation flex-col items-center gap-3 border border-[#00f2ff]/40 bg-black/70 px-4 py-4 pointer-events-auto bottom-[max(7rem,calc(env(safe-area-inset-bottom)+5rem))] hud-compact:bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:px-6"
          >
            <div className="text-[0.7rem] text-gray-400 uppercase tracking-widest">Lust — Choose Seal Influence</div>
            <div className="text-xs text-gray-200 text-center max-w-xs">
              {gameState.instructionText}
            </div>
            <div className="flex gap-4 mt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const cb = (gameRef.current as any)?.alignmentChoiceCallback;
                  if (cb) {
                    (gameRef.current as any).alignmentChoiceCallback = null;
                    cb(Alignment.LIGHT);
                  }
                }}
                className="px-5 py-2 bg-amber-500/20 border border-amber-400 text-amber-300 hover:bg-amber-500/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                Light
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const cb = (gameRef.current as any)?.alignmentChoiceCallback;
                  if (cb) {
                    (gameRef.current as any).alignmentChoiceCallback = null;
                    cb(Alignment.DARK);
                  }
                }}
                className="px-5 py-2 bg-purple-600/20 border border-purple-400 text-purple-300 hover:bg-purple-600/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                Dark (Corrupt)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameState && gameState.currentPhase !== Phase.GAME_OVER && gameState.decisionContext && gameState.decisionContext !== 'ALMIGHTY_MARKER_TYPE' && gameState.decisionContext !== 'DESTROYER_MARKER_TYPE' && gameState.decisionContext !== 'LUST_SEAL_INFLUENCE' && gameState.decisionContext !== 'DEATH_CREATURE_TYPE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-panel absolute left-1/2 z-[85] flex min-w-0 w-[min(100%,24rem)] max-w-[calc(100vw-1.25rem)] sm:min-w-[280px] -translate-x-1/2 touch-manipulation flex-col items-center gap-3 border border-[#00f2ff]/40 bg-black/70 px-4 py-4 pointer-events-auto bottom-[max(7rem,calc(env(safe-area-inset-bottom)+5rem))] hud-compact:bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:px-6"
          >
            <div className="text-[0.7rem] text-[#00f2ff] uppercase tracking-widest font-semibold border-b border-white/20 pb-2 w-full text-center">
              {gameState.decisionContext === 'FALLEN_ONE' && 'Fallen One (Limbo) — Nullify?'}
              {gameState.decisionContext === 'LUNA_NULLIFY' && 'Luna (Limbo) — Nullify influence change?'}
              {gameState.decisionContext === 'DELTA_SACRIFICE' && 'Delta — Sacrifice for +3?'}
            </div>
            <div className="text-xs text-gray-200 text-center max-w-sm leading-relaxed">
              {gameState.decisionMessage ?? gameState.instructionText}
            </div>
            <div className="flex gap-4 mt-1">
              <button
                onClick={() => handleDecision(true)}
                className="px-6 py-1.5 bg-[#00f2ff]/20 border border-[#00f2ff] text-[#00f2ff] hover:bg-[#00f2ff]/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                {(gameState.decisionContext === 'FALLEN_ONE' || gameState.decisionContext === 'LUNA_NULLIFY') ? 'Yes, nullify' : 'Yes, activate'}
              </button>
              <button
                onClick={() => handleDecision(false)}
                className="px-6 py-1.5 bg-white/5 border border-white/20 hover:border-white/40 transition-all text-[0.65rem] tracking-widest uppercase font-bold"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone Search Modal (Limbo / Graveyard / Deck) */}
      <AnimatePresence>
        {gameState && zoneSearchModal && (
          <ZoneSearchModal
            zone={zoneSearchModal}
            playerCards={
              zoneSearchModal === 'limbo' ? (gameState.playerLimboCards ?? [])
              : zoneSearchModal === 'graveyard' ? (gameState.playerGraveyardCards ?? [])
              : (gameState.playerDeckCards ?? [])
            }
            enemyCards={
              zoneSearchModal === 'limbo' ? (gameState.enemyLimboCards ?? [])
              : zoneSearchModal === 'graveyard' ? (gameState.enemyGraveyardCards ?? [])
              : (gameState.enemyDeckCards ?? [])
            }
            isSelectingTarget={gameState.isSelectingLimboTarget === true && zoneSearchModal === 'limbo'}
            onClose={() => setZoneSearchModal(null)}
            onSelectLimboCard={(zone, index) => {
              gameRef.current?.selectLimboCardForAbility(zone, index);
              setZoneSearchModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Version Badge */}
      <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[120] max-w-[min(12rem,46vw)] text-right text-[0.5rem] tracking-widest text-gray-500 sm:max-w-none sm:text-[0.65rem]">
        <span className="hidden min-[380px]:inline">VERSION PUBLISHED: </span>
        <span className="min-[380px]:hidden" aria-hidden>
          Ver.{' '}
        </span>
        <span className="text-gray-300">{GAME_VERSION}</span>
      </div>
    </div>
  );
}

/** Modal to search/browse Limbo, Graveyard, or Deck; supports selecting a card for Sentinel ability when isSelectingTarget (Limbo only). */
function ZoneSearchModal({
  zone,
  playerCards,
  enemyCards,
  isSelectingTarget,
  onClose,
  onSelectLimboCard
}: {
  zone: 'limbo' | 'graveyard' | 'deck';
  playerCards: HoveredCardInfo[];
  enemyCards: HoveredCardInfo[];
  isSelectingTarget: boolean;
  onClose: () => void;
  onSelectLimboCard: (zone: 'player' | 'enemy', index: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const zoneLabel = zone === 'limbo' ? 'Limbo' : zone === 'graveyard' ? 'Graveyard' : 'Deck';

  const filterCards = (cards: HoveredCardInfo[]) =>
    cards
      .map((card, index) => ({ card, index }))
      .filter(
        ({ card: c }) =>
          !filter.trim() ||
          c.name.toLowerCase().includes(filter.toLowerCase()) ||
          c.type.toLowerCase().includes(filter.toLowerCase()) ||
          c.faction.toLowerCase().includes(filter.toLowerCase())
      );

  const playerFiltered = filterCards(playerCards);
  const enemyFiltered = filterCards(enemyCards);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-panel border border-[#00f2ff]/40 bg-black/90 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
          <h2 className="text-lg tracking-widest uppercase text-[#00f2ff] font-bold">
            Search {zoneLabel}
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white/5 border border-white/20 hover:border-white/40 text-[0.65rem] tracking-widest uppercase"
          >
            Close
          </button>
        </div>
        <div className="p-4 border-b border-white/10">
          <input
            type="text"
            placeholder="Filter by name, type, or faction..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded text-sm text-white placeholder-gray-500 focus:border-[#00f2ff]/60 focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <h3 className="text-[0.7rem] text-[#00f2ff] uppercase tracking-widest mb-2">Your {zoneLabel}</h3>
            {playerFiltered.length === 0 ? (
              <p className="text-[0.7rem] text-gray-500">No cards</p>
            ) : (
              <ul className="space-y-1">
                {playerFiltered.map(({ card, index: originalIndex }) => {
                  const clickable = isSelectingTarget && zone === 'limbo';
                  return (
                    <li
                      key={`player-${originalIndex}-${card.name}`}
                      onClick={() => clickable && onSelectLimboCard('player', originalIndex)}
                      role={clickable ? 'button' : undefined}
                      className={`flex min-h-11 touch-manipulation items-center gap-3 rounded border px-3 py-3 text-left text-[0.75rem] active:bg-white/[0.03] ${
                        clickable
                          ? 'border-[#00f2ff]/50 cursor-pointer hover:bg-[#00f2ff]/10 hover:border-[#00f2ff]'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <span className="font-semibold text-white shrink-0 w-28 truncate">{card.name}</span>
                      <span className="text-[#00f2ff] shrink-0">P{card.power + card.powerMarkers - card.weaknessMarkers}</span>
                      <span className="text-gray-400 shrink-0">{card.type}</span>
                      <span className="text-gray-500 truncate flex-1 min-w-0">{card.ability}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-[0.7rem] text-[#ff0044]/90 uppercase tracking-widest mb-2">Enemy {zoneLabel}</h3>
            {enemyFiltered.length === 0 ? (
              <p className="text-[0.7rem] text-gray-500">No cards</p>
            ) : (
              <ul className="space-y-1">
                {enemyFiltered.map(({ card, index: originalIndex }) => {
                  const clickable = isSelectingTarget && zone === 'limbo';
                  return (
                    <li
                      key={`enemy-${originalIndex}-${card.name}`}
                      onClick={() => clickable && onSelectLimboCard('enemy', originalIndex)}
                      role={clickable ? 'button' : undefined}
                      className={`flex min-h-11 touch-manipulation items-center gap-3 rounded border px-3 py-3 text-left text-[0.75rem] active:bg-white/[0.03] ${
                        clickable
                          ? 'border-[#00f2ff]/50 cursor-pointer hover:bg-[#00f2ff]/10 hover:border-[#00f2ff]'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <span className="font-semibold text-white shrink-0 w-28 truncate">{card.name}</span>
                      <span className="text-[#00f2ff] shrink-0">P{card.power + card.powerMarkers - card.weaknessMarkers}</span>
                      <span className="text-gray-400 shrink-0">{card.type}</span>
                      <span className="text-gray-500 truncate flex-1 min-w-0">{card.ability}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        {isSelectingTarget && zone === 'limbo' && (
          <div className="p-3 border-t border-white/10 text-[0.65rem] text-gray-400 text-center">
            Click a creature to add its Power to Sentinel.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function AlignmentCard({ title, description, icon, color, onClick }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex w-full max-w-[min(280px,92vw)] cursor-pointer touch-manipulation flex-col items-center justify-center rounded-2xl border-2 border-white/10 p-6 text-center transition-colors hover:bg-white/5 sm:h-[350px] sm:w-[250px] sm:max-w-none active:opacity-95"
      style={{ borderColor: `${color}44` }}
    >
      <div className="text-5xl mb-4" style={{ color }}>{icon}</div>
      <h2 className="text-2xl mb-4 tracking-widest" style={{ color }}>{title}</h2>
      <p className="text-[0.7rem] text-gray-500 italic leading-relaxed">{description}</p>
    </motion.div>
  );
}

/** Magnified card preview over the interaction log; disappears when not hovering a card. Uses z-[90] so it appears above decision dialogs (z-[80]) when you need to read cards during prompts. */
function CardPreviewOverlay({ card }: { card: HoveredCardInfo }) {
  const effectivePower = card.power + card.powerMarkers - card.weaknessMarkers;
  const faceSrc = card.faceArtPath ? cardArtUrl(card.faceArtPath) : undefined;

  return (
    <div className="pointer-events-none absolute right-0 top-1/2 z-[90] flex h-[min(32rem,72vh)] w-[min(20rem,92vw)] -translate-y-1/2 items-center justify-center p-2 hud-compact:left-1/2 hud-compact:right-auto hud-compact:top-[22%] hud-compact:h-[min(11rem,38vh)] hud-compact:w-[min(10rem,42vw)] hud-compact:-translate-x-1/2 hud-compact:-translate-y-1/2">
      <div className="w-full h-full rounded-xl overflow-hidden border-2 border-white/20 bg-black/90 shadow-2xl flex flex-col">
        {/* Card art or placeholder */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black/60">
          {faceSrc ? (
            <img
              src={faceSrc}
              alt={card.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-gray-500 text-center px-4 font-cinzel text-sm">
              {card.name}
            </div>
          )}
        </div>
        {/* Overlay: name, power, markers, type */}
        <div className="shrink-0 p-3 bg-gradient-to-t from-black/95 to-transparent border-t border-white/10 space-y-1">
          <div className="text-white font-bold text-sm uppercase tracking-wider truncate">{card.name}</div>
          <div className="flex items-center justify-between gap-2 text-[0.7rem]">
            <span className="text-[#00f2ff] font-bold">Power {effectivePower}</span>
            {card.powerMarkers > 0 && (
              <span className="text-[#00f2ff]">+{card.powerMarkers} P</span>
            )}
            {card.weaknessMarkers > 0 && (
              <span className="text-[#ff0044]">−{card.weaknessMarkers} W</span>
            )}
          </div>
          <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">
            {card.faction} · {card.isChampion ? 'Champion' : card.type}
          </div>
          <div className="text-[0.6rem] text-gray-500 leading-tight line-clamp-2">{card.ability}</div>
        </div>
      </div>
    </div>
  );
}
