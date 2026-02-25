/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameController } from './game/GameController';
import { Alignment, Phase, GameState } from './types';

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

  return (
    <div className="relative w-full h-screen overflow-hidden font-cinzel">
      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Counter Overlay */}
      <AnimatePresence>
        {gameState?.currentPhase === Phase.COUNTER_ALLOCATION && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-[220px] left-1/2 -translate-x-1/2 z-50 glass-panel p-6 rounded-xl border-2 border-[#00f2ff] shadow-[0_0_30px_rgba(0,242,255,0.5)] pointer-events-auto text-center min-w-[300px]"
          >
            <div className="text-sm mb-4 tracking-widest uppercase">Allocate Counters</div>
            <div className="flex justify-center gap-8 mb-6">
              <div className="flex flex-col items-center">
                <div className="text-[0.6rem] text-gray-500 uppercase mb-1">Power Markers</div>
                <div className="text-2xl text-[#00f2ff] font-bold">{gameState.powerPool}</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-[0.6rem] text-gray-500 uppercase mb-1">Weakness</div>
                <div className="text-2xl text-[#ff0044] font-bold">{gameState.weaknessPool}</div>
              </div>
            </div>
            <button
              onClick={handleFinishCounters}
              className="px-6 py-2 bg-white/5 border border-white/20 hover:border-[#00f2ff] hover:text-[#00f2ff] transition-all text-xs tracking-widest uppercase font-bold"
            >
              Done
            </button>
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

      {/* HUD */}
      {gameState && !showSelection && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10">
          {/* Top Bar */}
          <div className="hud-gradient-top p-6 flex justify-between items-start pointer-events-auto">
            <div className={`p-4 rounded-lg glass-panel min-w-[150px] ${gameState.playerAlignment === Alignment.LIGHT ? 'dark-glow' : 'light-glow'}`}>
              <div className="text-[0.7rem] text-[#ff0044]">ENEMY</div>
              <div className="text-3xl">{gameState.enemyScore} / 7</div>
              <div className="text-[0.6rem] text-gray-400 mt-1">DECK: {gameState.enemyDeckCount}</div>
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
              <div className="text-[0.6rem] text-gray-400 mt-1">DECK: {gameState.playerDeckCount}</div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="hud-gradient-bottom p-8 flex flex-col items-center pointer-events-auto">
            <div className="text-sm text-gray-300 italic text-center max-w-2xl">
              {gameState.instructionText}
            </div>
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
          </div>
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
