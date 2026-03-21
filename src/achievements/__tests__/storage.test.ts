/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { computeAchievementsAfterGame } from '../storage';
import type { AchievementsProgress, GameEndStats } from '../types';

const empty: AchievementsProgress = { v: 1, unlocked: [], winStreak: 0, loseStreak: 0 };

describe('computeAchievementsAfterGame', () => {
  it('unlocks first victory and seal tiers on a win', () => {
    const stats: GameEndStats = {
      result: 'player',
      playerSealCount: 5,
      enemySealCount: 2,
      roundEnded: 2,
    };
    const { next, newlyUnlocked } = computeAchievementsAfterGame(stats, empty);
    expect(newlyUnlocked).toContain('first_victory');
    expect(newlyUnlocked).toContain('seals_4');
    expect(newlyUnlocked).toContain('seals_5');
    expect(newlyUnlocked).not.toContain('seals_6');
    expect(next.winStreak).toBe(1);
    expect(next.loseStreak).toBe(0);
  });

  it('win_cycle_1 only when roundEnded is 1', () => {
    const a = computeAchievementsAfterGame(
      { result: 'player', playerSealCount: 7, enemySealCount: 0, roundEnded: 1 },
      empty
    );
    expect(a.newlyUnlocked).toContain('win_cycle_1');
    expect(a.newlyUnlocked).toContain('win_by_cycle_2');

    const b = computeAchievementsAfterGame(
      { result: 'player', playerSealCount: 7, enemySealCount: 0, roundEnded: 3 },
      empty
    );
    expect(b.newlyUnlocked).not.toContain('win_cycle_1');
    expect(b.newlyUnlocked).not.toContain('win_by_cycle_2');
  });

  it('increments win streak and unlocks at 10', () => {
    let prev: AchievementsProgress = { v: 1, unlocked: [], winStreak: 9, loseStreak: 0 };
    const { next, newlyUnlocked } = computeAchievementsAfterGame(
      { result: 'player', playerSealCount: 4, enemySealCount: 0, roundEnded: 1 },
      prev
    );
    expect(next.winStreak).toBe(10);
    expect(newlyUnlocked).toContain('streak_wins_10');
  });

  it('loss resets win streak and builds loss streak', () => {
    const prev: AchievementsProgress = { v: 1, unlocked: [], winStreak: 5, loseStreak: 0 };
    const { next } = computeAchievementsAfterGame(
      { result: 'enemy', playerSealCount: 2, enemySealCount: 5, roundEnded: 2 },
      prev
    );
    expect(next.winStreak).toBe(0);
    expect(next.loseStreak).toBe(1);
  });

  it('draw resets both streaks', () => {
    const prev: AchievementsProgress = { v: 1, unlocked: [], winStreak: 3, loseStreak: 2 };
    const { next } = computeAchievementsAfterGame(
      { result: 'draw', playerSealCount: 3, enemySealCount: 3, roundEnded: 2 },
      prev
    );
    expect(next.winStreak).toBe(0);
    expect(next.loseStreak).toBe(0);
  });

  it('does not duplicate unlocks', () => {
    const prev: AchievementsProgress = {
      v: 1,
      unlocked: ['first_victory', 'seals_4'],
      winStreak: 1,
      loseStreak: 0,
    };
    const { newlyUnlocked } = computeAchievementsAfterGame(
      { result: 'player', playerSealCount: 4, enemySealCount: 3, roundEnded: 1 },
      prev
    );
    expect(newlyUnlocked).not.toContain('first_victory');
    expect(newlyUnlocked).not.toContain('seals_4');
  });
});
