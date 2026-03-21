/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AchievementDef } from './types';

/** All trackable achievements (order = display order). */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_victory',
    title: 'First Seal Broken',
    description: 'Win any game as the player.',
    icon: '◇',
  },
  {
    id: 'seals_4',
    title: 'Quorum of Four',
    description: 'Win while controlling at least 4 Seals.',
    icon: '④',
  },
  {
    id: 'seals_5',
    title: 'Fivefold Claim',
    description: 'Win while controlling at least 5 Seals.',
    icon: '⑤',
  },
  {
    id: 'seals_6',
    title: 'Sixth Echo',
    description: 'Win while controlling at least 6 Seals.',
    icon: '⑥',
  },
  {
    id: 'seals_7',
    title: 'All Seven',
    description: 'Win holding every Seal.',
    icon: '⑦',
  },
  {
    id: 'win_cycle_1',
    title: 'Swift Binding — Cycle I',
    description: 'Win before the second cycle begins (still on round 1).',
    icon: 'Ⅰ',
  },
  {
    id: 'win_by_cycle_2',
    title: 'Swift Binding — Cycle II',
    description: 'Win by the end of your second cycle (round 1 or 2).',
    icon: 'Ⅱ',
  },
  {
    id: 'streak_wins_10',
    title: 'Unbroken Light',
    description: 'Win 10 games in a row. (Draws reset the chain.)',
    icon: '☀',
    progressKind: 'win_streak',
    progressGoal: 10,
  },
  {
    id: 'streak_losses_10',
    title: 'Tenfold Eclipse',
    description: 'Lose 10 games in a row. (Draws reset the chain.)',
    icon: '☾',
    progressKind: 'loss_streak',
    progressGoal: 10,
  },
];

export const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
