/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Alignment {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  NEUTRAL = 'NEUTRAL'
}

export enum Phase {
  PREP = 'PREP',
  RESOLUTION = 'RESOLUTION',
  COUNTER_ALLOCATION = 'COUNTER_ALLOCATION',
  ABILITY_TARGETING = 'ABILITY_TARGETING',
  SEAL_TARGETING = 'SEAL_TARGETING',
  GAME_OVER = 'GAME_OVER'
}

export interface CardData {
  name: string;
  faction: string;
  type: string;
  power: number;
  isChampion: boolean;
  ability: string;
  markerPower?: number;
  markerWeakness?: number;
  needsAllocation?: boolean;
  hasTargetedAbility?: boolean;
  effect?: string;
  targetType?: string;
  hasNullify?: boolean;
  hasSealTargetAbility?: boolean;
  sealEffect?: string;
  hasGlobalAbility?: boolean;
  hasHaste?: boolean;
  hasLimboAbility?: boolean;
  hasActivate?: boolean;
}

export interface GameState {
  playerAlignment: Alignment;
  currentRound: number;
  currentPhase: Phase;
  playerScore: number;
  enemyScore: number;
  playerDeckCount: number;
  enemyDeckCount: number;
  playerGraveyardCount: number;
  enemyGraveyardCount: number;
  instructionText: string;
  phaseStep: string;
  powerPool: number;
  weaknessPool: number;
  abilitySourceCardName?: string;
  lockedSealIndex?: number;
  logs: string[];
}
