/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ACHIEVEMENTS } from '../achievements/definitions';
import { loadAchievementsProgress } from '../achievements/storage';
import type { GameEndStats } from '../achievements/types';

type Props = {
  result: 'player' | 'enemy' | 'draw';
  gameOverStats?: GameEndStats;
  newThisSession: string[];
  className?: string;
};

export function GameOverAchievements({ result, gameOverStats, newThisSession, className = '' }: Props) {
  const progress = useMemo(() => loadAchievementsProgress(), []);
  const newSet = useMemo(() => new Set(newThisSession), [newThisSession]);
  const unlockedSet = useMemo(() => new Set(progress.unlocked), [progress.unlocked]);

  const subtitle =
    result === 'player'
      ? 'Your oaths are etched into the cycle.'
      : result === 'enemy'
        ? 'The void remembers every fall — rise again.'
        : 'Balance is its own victory.';

  return (
    <div className={`flex flex-col min-h-0 h-full ${className}`}>
      <div className="shrink-0 border-b border-white/10 pb-2 mb-2">
        <h2 className="text-[0.6rem] tracking-[0.3em] uppercase text-[#00f2ff]/90 font-bold">Achievements</h2>
        <p className="text-[0.58rem] text-gray-500 mt-0.5 leading-tight line-clamp-2">{subtitle}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[0.52rem] text-gray-500 font-mono">
          {gameOverStats && (
            <>
              <span>
                Seals <span className="text-gray-300">{gameOverStats.playerSealCount}</span>–
                <span className="text-gray-300">{gameOverStats.enemySealCount}</span>
              </span>
              <span>
                Cycle <span className="text-gray-300">{gameOverStats.roundEnded}</span>
              </span>
            </>
          )}
          <span className="text-[#00f2ff]/70">
            <span className="text-white">{progress.winStreak}</span>W ·{' '}
            <span className="text-white">{progress.loseStreak}</span>L
          </span>
        </div>
        <p className="text-[0.48rem] text-gray-600 uppercase tracking-wider mt-1.5 leading-tight">
          Saved in browser (cookie + backup)
        </p>
      </div>

      {/* No scroll: compact fixed list */}
      <ul className="flex flex-col gap-1 flex-1 min-h-0 justify-start">
        {ACHIEVEMENTS.map((def) => {
          const done = unlockedSet.has(def.id);
          const isNew = newSet.has(def.id);
          const goal = def.progressGoal ?? 10;
          let streakCurrent = 0;
          if (def.progressKind === 'win_streak') streakCurrent = progress.winStreak;
          if (def.progressKind === 'loss_streak') streakCurrent = progress.loseStreak;
          const showStreakBar = !done && def.progressKind && def.progressGoal;
          const streakPct = showStreakBar ? Math.min(100, (streakCurrent / goal) * 100) : 0;
          const streakLabel = showStreakBar
            ? def.progressKind === 'win_streak'
              ? `${streakCurrent}/${goal} wins`
              : `${streakCurrent}/${goal} losses`
            : null;

          return (
            <motion.li
              key={def.id}
              layout
              initial={isNew ? { scale: 0.98, opacity: 0 } : false}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: isNew ? '0 0 12px rgba(250, 204, 21, 0.28)' : '0 0 0 rgba(0,0,0,0)',
              }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              className={[
                'rounded-md border px-2 py-1 flex gap-2 items-center text-left',
                done ? 'border-[#00f2ff]/35 bg-[#00f2ff]/[0.06]' : 'border-white/[0.08] bg-black/25',
                isNew ? 'ring-1 ring-amber-400/50' : '',
              ].join(' ')}
              title={def.description}
            >
              <span
                className={[
                  'text-sm shrink-0 w-6 h-6 flex items-center justify-center rounded font-serif leading-none',
                  done ? 'text-[#00f2ff]' : 'text-gray-600',
                ].join(' ')}
                aria-hidden
              >
                {done ? '✓' : def.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-[0.62rem] font-bold tracking-wide truncate ${done ? 'text-gray-100' : 'text-gray-500'}`}
                  >
                    {def.title}
                  </span>
                  {isNew && (
                    <span className="text-[0.45rem] uppercase tracking-wider px-1 py-px rounded bg-amber-500/20 text-amber-200/90 border border-amber-400/35 shrink-0">
                      New
                    </span>
                  )}
                </div>
                <p className="text-[0.52rem] text-gray-600 leading-snug line-clamp-1">{def.description}</p>
                {streakLabel && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-0.5 rounded-full bg-white/[0.08] overflow-hidden min-w-0">
                      <div
                        className={`h-full rounded-full ${
                          def.progressKind === 'win_streak'
                            ? 'bg-gradient-to-r from-[#00f2ff]/50 to-[#00f2ff]'
                            : 'bg-gradient-to-r from-[#ff0044]/35 to-[#ff0044]/75'
                        }`}
                        style={{ width: `${streakPct}%` }}
                      />
                    </div>
                    <span className="text-[0.48rem] text-gray-600 font-mono shrink-0">{streakLabel}</span>
                  </div>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
