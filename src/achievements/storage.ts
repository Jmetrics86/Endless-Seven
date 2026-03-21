/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ACHIEVEMENTS } from './definitions';
import type { AchievementsProgress, GameEndStats } from './types';
import {
  ACHIEVEMENTS_COOKIE_MAX_AGE_SEC,
  ACHIEVEMENTS_COOKIE_NAME,
  ACHIEVEMENTS_STORAGE_VERSION,
} from './types';

function defaultProgress(): AchievementsProgress {
  return {
    v: ACHIEVEMENTS_STORAGE_VERSION,
    unlocked: [],
    winStreak: 0,
    loseStreak: 0,
  };
}

function parseProgress(raw: string | null | undefined): AchievementsProgress {
  if (!raw) return defaultProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<AchievementsProgress>;
    if (parsed.v !== ACHIEVEMENTS_STORAGE_VERSION || !Array.isArray(parsed.unlocked)) {
      return defaultProgress();
    }
    return {
      v: ACHIEVEMENTS_STORAGE_VERSION,
      unlocked: [...new Set(parsed.unlocked.filter((x) => typeof x === 'string'))],
      winStreak: Math.max(0, Math.min(999, Number(parsed.winStreak) || 0)),
      loseStreak: Math.max(0, Math.min(999, Number(parsed.loseStreak) || 0)),
    };
  } catch {
    return defaultProgress();
  }
}

/** Read cookie `name` from document.cookie. */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length));
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function loadAchievementsProgress(): AchievementsProgress {
  const fromCookie = getCookie(ACHIEVEMENTS_COOKIE_NAME);
  if (fromCookie) return parseProgress(fromCookie);
  try {
    const ls = localStorage.getItem(ACHIEVEMENTS_COOKIE_NAME);
    if (ls) return parseProgress(ls);
  } catch {
    /* ignore */
  }
  return defaultProgress();
}

export function saveAchievementsProgress(progress: AchievementsProgress): void {
  const payload = JSON.stringify(progress);
  setCookie(ACHIEVEMENTS_COOKIE_NAME, payload, ACHIEVEMENTS_COOKIE_MAX_AGE_SEC);
  try {
    localStorage.setItem(ACHIEVEMENTS_COOKIE_NAME, payload);
  } catch {
    /* ignore — cookie is primary */
  }
}

/**
 * Apply a finished game to streaks and unlocks. Does not persist — caller should `saveAchievementsProgress(next)`.
 */
export function computeAchievementsAfterGame(
  stats: GameEndStats,
  prev: AchievementsProgress
): { next: AchievementsProgress; newlyUnlocked: string[] } {
  const unlocked = new Set(prev.unlocked);
  const newlyUnlocked: string[] = [];

  const add = (id: string) => {
    if (!ACHIEVEMENTS.some((a) => a.id === id)) return;
    if (unlocked.has(id)) return;
    unlocked.add(id);
    newlyUnlocked.push(id);
  };

  let winStreak = prev.winStreak;
  let loseStreak = prev.loseStreak;

  if (stats.result === 'player') {
    winStreak += 1;
    loseStreak = 0;

    add('first_victory');
    if (stats.playerSealCount >= 4) add('seals_4');
    if (stats.playerSealCount >= 5) add('seals_5');
    if (stats.playerSealCount >= 6) add('seals_6');
    if (stats.playerSealCount >= 7) add('seals_7');
    if (stats.roundEnded === 1) add('win_cycle_1');
    if (stats.roundEnded <= 2) add('win_by_cycle_2');
    if (winStreak >= 10) add('streak_wins_10');
  } else if (stats.result === 'enemy') {
    loseStreak += 1;
    winStreak = 0;
    if (loseStreak >= 10) add('streak_losses_10');
  } else {
    winStreak = 0;
    loseStreak = 0;
  }

  const next: AchievementsProgress = {
    v: ACHIEVEMENTS_STORAGE_VERSION,
    unlocked: [...unlocked],
    winStreak,
    loseStreak,
  };

  return { next, newlyUnlocked };
}

export function recordGameEndAndPersist(stats: GameEndStats): string[] {
  const prev = loadAchievementsProgress();
  const { next, newlyUnlocked } = computeAchievementsAfterGame(stats, prev);
  saveAchievementsProgress(next);
  return newlyUnlocked;
}
