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
  DELTA_BUFF_TARGETING = 'DELTA_BUFF_TARGETING',
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
  /** Baron: Swap with creature in Limbo you control */
  hasSwapAbility?: boolean;
  /** Fledgeling: Cannot battle or be battled */
  cannotBattleOrBeBattled?: boolean;
  /** Fledgeling: Sacrifice at end of turn */
  sacrificeEndOfTurn?: boolean;
  /** Sloth: Unaffected by abilities */
  abilityImmune?: boolean;
  /** Lust: After sacrifice, may change seal influence if no champion */
  hasLustSealEffect?: boolean;
}

/** Card summary for magnified hover preview (small screens). */
export interface HoveredCardInfo {
  name: string;
  faction: string;
  power: number;
  type: string;
  isChampion: boolean;
  ability: string;
  powerMarkers: number;
  weaknessMarkers: number;
  /** Path under public/ for face art, or undefined if none. */
  faceArtPath?: string;
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
  decisionContext?: 'FALLEN_ONE' | 'DELTA_SACRIFICE' | 'LUNA_NULLIFY' | 'ALMIGHTY_MARKER_TYPE' | 'LUST_SEAL_INFLUENCE';
  /** Seal index when choosing influence (e.g. Lust effect). */
  sealIndexForChoice?: number;
  /** Stable message for the current decision dialog (not overwritten by hover). */
  decisionMessage?: string;
  logs: string[];
  /** Set when a card is hovered (for small-screen magnified preview). Cleared when not hovered or when a prompt is active. */
  hoveredCard?: HoveredCardInfo | null;
  /** Card summaries for Limbo/Graveyard search UI. Updated whenever state is pushed. */
  playerLimboCards: HoveredCardInfo[];
  enemyLimboCards: HoveredCardInfo[];
  playerGraveyardCards: HoveredCardInfo[];
  enemyGraveyardCards: HoveredCardInfo[];
  /** Card summaries for Deck search UI (read-only browse). */
  playerDeckCards: HoveredCardInfo[];
  enemyDeckCards: HoveredCardInfo[];
  /** True when in ABILITY_TARGETING and the target must be a creature in Limbo (e.g. Sentinel). */
  isSelectingLimboTarget?: boolean;
}
