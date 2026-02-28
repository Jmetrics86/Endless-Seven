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

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameController | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSelection, setShowSelection] = useState(true);

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

  const handleSelectAlignment = (side: Alignment) => {
    setShowSelection(false);
    gameRef.current?.selectAlignment(side);
  };

  const handleEndPrep = () => {
    gameRef.current?.endPrep();
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
    <div className="relative w-full h-screen overflow-hidden font-cinzel">
      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Counter Overlay */}
      <AnimatePresence>
        {gameState?.currentPhase === Phase.COUNTER_ALLOCATION && (
          <motion.div
            initial={{ opacity: 0, x: -40, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -40, y: 0 }}
            className="absolute top-1/2 left-6 -translate-y-1/2 z-50 glass-panel px-4 py-3 rounded-lg border border-[#00f2ff]/40 bg-black/70 shadow-[0_0_20px_rgba(0,242,255,0.35)] pointer-events-auto text-left min-w-[180px] space-y-2"
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
              onClick={handleFinishCounters}
              className="mt-1 px-4 py-1 bg-white/5 border border-white/15 hover:border-[#00f2ff] hover:text-[#00f2ff] transition-all text-[0.6rem] tracking-widest uppercase font-semibold"
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
            className="absolute top-24 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-4 rounded-lg border border-[#00f2ff]/40 bg-black/80 pointer-events-none text-center"
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
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050508] text-white"
          >
            <h1 className="text-5xl tracking-[10px] mb-4">ENDLESS SEVEN</h1>
            <p className="text-gray-500 italic mb-12">"Choose your side. Seal the heartbeat of the world."</p>
            
            <div className="flex gap-12">
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
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10">
          {/* Top Bar */}
          <div className="hud-gradient-top p-6 flex justify-between items-start pointer-events-auto">
            <div className={`p-4 rounded-lg glass-panel min-w-[150px] ${gameState.playerAlignment === Alignment.LIGHT ? 'dark-glow' : 'light-glow'}`}>
              <div className="text-[0.7rem] text-[#ff0044]">ENEMY</div>
              <div className="text-3xl">{gameState.enemyScore} / 7</div>
              <div className="flex justify-between text-[0.6rem] text-gray-400 mt-1">
                <span>DECK: {gameState.enemyDeckCount}</span>
                <span>GRAVE: {gameState.enemyGraveyardCount}</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="glass-panel px-6 py-2 rounded-b-xl border-t-0 flex gap-8 items-center">
                <div className="text-center">
                  <div className="text-lg text-white">ROUND {gameState.currentRound}</div>
                  <div className="text-[0.6rem] text-gray-500 uppercase tracking-widest">Awaiting Command</div>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div className="text-center min-w-[150px]">
                  <div className="text-xl text-white uppercase tracking-widest">{gameState.currentPhase.replace('_', ' ')}</div>
                  <div className="text-[0.65rem] text-[#00f2ff] font-bold uppercase tracking-widest">{gameState.phaseStep}</div>
                </div>
              </div>
              {gameState.currentPhase === Phase.PREP && (
                <button
                  onClick={handleEndPrep}
                  className="pointer-events-auto px-6 py-2 bg-white/5 border border-white/20 hover:border-[#00f2ff] hover:text-[#00f2ff] transition-all text-xs tracking-widest uppercase font-bold"
                >
                  End Prep Phase
                </button>
              )}
            </div>

            <div className={`p-4 rounded-lg glass-panel min-w-[150px] text-right ${gameState.playerAlignment === Alignment.LIGHT ? 'light-glow' : 'dark-glow'}`}>
              <div className="text-[0.7rem] text-[#00f2ff]">YOU</div>
              <div className="text-3xl">{gameState.playerScore} / 7</div>
              <div className="flex justify-between text-[0.6rem] text-gray-400 mt-1">
                <span>GRAVE: {gameState.playerGraveyardCount}</span>
                <span>DECK: {gameState.playerDeckCount}</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="hud-gradient-bottom p-8 flex flex-col items-center pointer-events-auto">
            <div className="text-sm text-gray-300 italic text-center max-w-2xl mb-4">
              {gameState.instructionText}
            </div>
            {gameState.currentPhase === Phase.PREP && (
              <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider text-center">
                Click a card in your Limbo to use its ability (e.g. Martyr, Saint Michael).
              </div>
            )}
          </div>

          {/* Side Log */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-72 h-[60vh] bg-black/40 backdrop-blur-md border-l border-white/10 p-4 pointer-events-auto flex flex-col overflow-hidden">
            <div className="text-[0.6rem] text-gray-500 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Interaction Log</div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
              {gameState.logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[0.7rem] leading-relaxed text-gray-300 font-mono"
                >
                  <span className="text-[#00f2ff] mr-2">»</span>
                  {log}
                </motion.div>
              ))}
              <div id="log-bottom" />
            </div>
            
            {/* Force Skip Button */}
            <button
              onClick={handleForceSkip}
              className="mt-4 px-4 py-2 bg-white/5 border border-white/10 hover:border-[#ff0044] hover:text-[#ff0044] transition-all text-[0.6rem] tracking-widest uppercase font-bold"
            >
              Skip Interaction
            </button>
          </div>

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
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <h1 className="text-6xl mb-4 tracking-[15px]">THE CYCLE ENDS</h1>
            <p className="text-xl text-gray-400 mb-12">{gameState.instructionText}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-12 py-4 border border-white/20 hover:border-[#00f2ff] hover:text-[#00f2ff] transition-all text-lg tracking-widest uppercase font-bold"
            >
              Begin New Cycle
            </button>
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
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[80] glass-panel px-6 py-4 border border-[#00f2ff]/40 bg-black/70 pointer-events-auto flex flex-col items-center gap-3"
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
        {gameState && gameState.currentPhase !== Phase.GAME_OVER && gameState.decisionContext && gameState.decisionContext !== 'ALMIGHTY_MARKER_TYPE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[80] glass-panel px-6 py-4 border border-[#00f2ff]/40 bg-black/70 pointer-events-auto flex flex-col items-center gap-3 min-w-[280px]"
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

      {/* Version Badge */}
      <div className="absolute bottom-4 right-6 z-[120] text-[0.65rem] tracking-widest text-gray-500 pointer-events-none">
        VERSION PUBLISHED: <span className="text-gray-300">{GAME_VERSION}</span>
      </div>
    </div>
  );
}

function AlignmentCard({ title, description, icon, color, onClick }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="w-[250px] h-[350px] border-2 border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-white/5"
      style={{ borderColor: `${color}44` }}
    >
      <div className="text-5xl mb-4" style={{ color }}>{icon}</div>
      <h2 className="text-2xl mb-4 tracking-widest" style={{ color }}>{title}</h2>
      <p className="text-[0.7rem] text-gray-500 italic leading-relaxed">{description}</p>
    </motion.div>
  );
}

/** Magnified card preview over the interaction log; disappears when not hovering a card. */
function CardPreviewOverlay({ card }: { card: HoveredCardInfo }) {
  const effectivePower = card.power + card.powerMarkers - card.weaknessMarkers;
  const faceSrc = card.faceArtPath ? cardArtUrl(card.faceArtPath) : undefined;

  return (
    <div
      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center p-2"
      style={{
        width: 'min(20rem, 92vw)',
        height: 'min(32rem, 72vh)'
      }}
    >
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
