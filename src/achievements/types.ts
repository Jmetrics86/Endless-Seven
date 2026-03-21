/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GameEndStats {
  result: 'player' | 'enemy' | 'draw';
  playerSealCount: number;
  enemySealCount: number;
  /** `currentRound` from game state when the game ended. */
  roundEnded: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Shown in checklist */
  icon: string;
  /** If set, show progress toward goal (e.g. streaks) */
  progressKind?: 'win_streak' | 'loss_streak';
  progressGoal?: number;
}

export interface AchievementsProgress {
  v: 1;
  unlocked: string[];
  winStreak: number;
  loseStreak: number;
}

export const ACHIEVEMENTS_STORAGE_VERSION = 1 as const;
export const ACHIEVEMENTS_COOKIE_NAME = 'es7_ach_v1';
/** ~400 days */
export const ACHIEVEMENTS_COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60;
