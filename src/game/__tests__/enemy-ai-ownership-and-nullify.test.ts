/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ensures AI targeting respects side ownership and Limbo nullify costs are Limbo-only / single-use safe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Alignment, Phase } from '../../types';
import type { CardData } from '../../types';
import { AbilityManager } from '../AbilityManager';
import type { CardEntity } from '../../entities/CardEntity';
import type { IGameController } from '../interfaces';

vi.mock('gsap', () => ({
  default: {
    to: vi.fn((_target: unknown, _vars: { onComplete?: () => void }) => {
      const vars = _vars as { onComplete?: () => void };
      if (typeof vars?.onComplete === 'function') vars.onComplete();
    }),
  },
}));

interface MockCard {
  data: CardData & {
    isEnemy: boolean;
    faceUp: boolean;
    powerMarkers: number;
    weaknessMarkers: number;
    isInvincible?: boolean;
    isSuppressed?: boolean;
  };
  updateVisualMarkers: () => void;
  applyBackTextureIfNeeded: () => void;
  mesh: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } };
}

function card(overrides: Partial<MockCard['data']> & { name: string; power: number }): MockCard {
  const data: MockCard['data'] = {
    name: 'Test',
    faction: 'Daemon',
    type: 'Creature',
    power: 5,
    isChampion: false,
    ability: '',
    isEnemy: false,
    faceUp: true,
    powerMarkers: 0,
    weaknessMarkers: 0,
    ...overrides,
  };
  return {
    data,
    updateVisualMarkers: vi.fn(),
    applyBackTextureIfNeeded: vi.fn(),
    mesh: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
  };
}

function createCtrl() {
  const state = {
    playerAlignment: Alignment.LIGHT,
    currentRound: 1,
    currentPhase: Phase.PREP,
    playerScore: 0,
    enemyScore: 0,
    playerDeckCount: 0,
    enemyDeckCount: 0,
    playerGraveyardCount: 0,
    enemyGraveyardCount: 0,
    instructionText: '',
    phaseStep: '',
    powerPool: 0,
    weaknessPool: 0,
    logs: [] as string[],
    playerLimboCards: [],
    enemyLimboCards: [],
    playerGraveyardCards: [],
    enemyGraveyardCards: [],
    playerDeckCards: [],
    enemyDeckCards: [],
  };
  const playerBattlefield: (MockCard | null)[] = Array(7).fill(null);
  const enemyBattlefield: (MockCard | null)[] = Array(7).fill(null);
  const playerLimbo: MockCard[] = [];
  const enemyLimbo: MockCard[] = [];
  const playerGraveyard: MockCard[] = [];
  const enemyGraveyard: MockCard[] = [];
  const seals = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    champion: null as MockCard | null,
    alignment: Alignment.NEUTRAL as Alignment,
  }));

  const mock = {
    state,
    playerBattlefield,
    enemyBattlefield,
    playerHand: [] as MockCard[],
    playerLimbo,
    enemyLimbo,
    playerGraveyard,
    enemyGraveyard,
    playerDeck: [] as CardData[],
    enemyDeck: [] as CardData[],
    enemyPrepRemainder: [] as CardData[],
    seals,
    playerLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    playerGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    sceneManager: {},
    entityManager: { add: vi.fn(), remove: vi.fn() },
    abilityManager: null as unknown as AbilityManager,
    uiManager: {},
    phaseManager: {},
    isProcessing: false,
    currentResolvingSealIndex: 0,
    sealCameraZoomedIn: false,
    cardsThatBattledThisRound: [] as CardEntity[],
    resolutionCallback: null as (() => void) | null,
    pendingAbilityData: null,
    nullifyCallback: null as ((b: boolean) => void) | null,
    sealSelectionCallback: null as ((n: number) => void) | null,
    updateState: vi.fn(),
    addLog: vi.fn(),
    destroyCard: vi.fn(),
    allocateCounters: vi.fn(),
    handleTargetedAbility: vi.fn(),
    executeGlobalAbility: vi.fn(),
    handleSealTargetAbility: vi.fn(),
    claimSeal: vi.fn(),
    appendEnemyPrepCardsToLimbo: vi.fn(),
    disposeCard: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    handleBattle: vi.fn(),
    showCombatDamageFloats: vi.fn(),
    handleSiege: vi.fn(),
    ascendToSeal: vi.fn(),
    checkGameOver: vi.fn(),
    startPrep: vi.fn(),
    endPrep: vi.fn(),
    startResolution: vi.fn(),
    resolveSeal: vi.fn(),
    forceSkip: vi.fn(),
    selectLimboCardForAbility: vi.fn(),
    isImmuneToAbilities: vi.fn(() => false),
    isProtected: () => false,
  };

  mock.abilityManager = new AbilityManager(mock as unknown as IGameController);
  return mock;
}

describe('Enemy AI ownership', () => {
  let ctrl: ReturnType<typeof createCtrl>;

  beforeEach(() => {
    ctrl = createCtrl();
    ctrl.playerBattlefield.fill(null);
    ctrl.enemyBattlefield.fill(null);
    ctrl.playerLimbo.length = 0;
    ctrl.enemyLimbo.length = 0;
    ctrl.playerGraveyard.length = 0;
    ctrl.enemyGraveyard.length = 0;
  });

  it('allocateCounters (isAI): Power markers only on friendly lane creatures, never opponent lane for power', async () => {
    const src = card({
      name: 'SpinnerProxy',
      power: 9,
      isEnemy: true,
      markerPower: 2,
      needsAllocation: true,
    });
    const ally = card({ name: 'Ally', power: 4, isEnemy: true });
    const foe = card({ name: 'Foe', power: 8, isEnemy: false });
    ctrl.enemyBattlefield[0] = ally;
    ctrl.playerBattlefield[0] = foe;

    await ctrl.abilityManager.allocateCounters(src as unknown as CardEntity, true);

    expect(ally.data.powerMarkers).toBe(2);
    expect(foe.data.powerMarkers).toBe(0);
  });

  it('allocateCounters (isAI): Weakness markers only on opponent lane', async () => {
    const src = card({
      name: 'WeakAlloc',
      power: 3,
      isEnemy: true,
      markerWeakness: 2,
      needsAllocation: true,
    });
    const ally = card({ name: 'Ally', power: 4, isEnemy: true });
    const foe = card({ name: 'Foe', power: 8, isEnemy: false });
    ctrl.enemyBattlefield[0] = ally;
    ctrl.playerBattlefield[0] = foe;

    await ctrl.abilityManager.allocateCounters(src as unknown as CardEntity, true);

    expect(foe.data.weaknessMarkers).toBe(2);
    expect(ally.data.weaknessMarkers).toBe(0);
  });

  it('allocateCounters (isAI): uses source isEnemy to pick lanes (defensive if isAI mis-synced)', async () => {
    const src = card({
      name: 'SpinnerProxy',
      power: 9,
      isEnemy: false,
      markerPower: 1,
      needsAllocation: true,
    });
    const playerCreature = card({ name: 'Mine', power: 5, isEnemy: false });
    const enemyCreature = card({ name: 'Theirs', power: 5, isEnemy: true });
    ctrl.playerBattlefield[0] = playerCreature;
    ctrl.enemyBattlefield[0] = enemyCreature;

    await ctrl.abilityManager.allocateCounters(src as unknown as CardEntity, true);

    expect(playerCreature.data.powerMarkers).toBe(1);
    expect(enemyCreature.data.powerMarkers).toBe(0);
  });

  it('enemy Sentinel (isAI) absorbs only from enemy Limbo, not player Limbo', async () => {
    const sentinel = card({
      name: 'Sentinel',
      power: 4,
      isEnemy: true,
      hasTargetedAbility: true,
      effect: 'sentinel_absorb',
      targetType: 'limbo_creature',
    });
    const playerHigh = card({ name: 'PlayerLimboBig', power: 9, isEnemy: false });
    const enemyLow = card({ name: 'EnemyLimboSmall', power: 2, isEnemy: true });
    ctrl.playerLimbo.push(playerHigh);
    ctrl.enemyLimbo.push(enemyLow);

    await ctrl.abilityManager.handleTargetedAbility(sentinel as unknown as CardEntity, true);

    expect(sentinel.data.powerMarkers).toBe(2);
  });
});

describe('Limbo nullify and Graveyard rules', () => {
  let ctrl: ReturnType<typeof createCtrl>;

  beforeEach(() => {
    ctrl = createCtrl();
    ctrl.playerLimbo.length = 0;
    ctrl.enemyLimbo.length = 0;
    ctrl.playerGraveyard.length = 0;
    ctrl.enemyGraveyard.length = 0;
  });

  it('moveToGraveyard: idempotent — second call does not duplicate in Graveyard', () => {
    const luna = card({ name: 'Luna', power: 2, isEnemy: true });
    ctrl.enemyLimbo.push(luna);

    ctrl.abilityManager.moveToGraveyard(luna as unknown as CardEntity);
    expect(ctrl.enemyGraveyard.length).toBe(1);

    ctrl.abilityManager.moveToGraveyard(luna as unknown as CardEntity);
    expect(ctrl.enemyGraveyard.length).toBe(1);
  });

  it('moveToGraveyard: already in Graveyard — silent no-op (single-use Limbo effects stay spent)', () => {
    const fo = card({ name: 'Fallen One', power: 6, isEnemy: true });
    ctrl.enemyGraveyard.push(fo);

    ctrl.abilityManager.moveToGraveyard(fo as unknown as CardEntity);

    expect(ctrl.enemyGraveyard.length).toBe(1);
  });

  it('moveToGraveyard: card in neither Limbo nor Graveyard — logs and does not add to Graveyard', () => {
    const fo = card({ name: 'Fallen One', power: 6, isEnemy: true });

    ctrl.abilityManager.moveToGraveyard(fo as unknown as CardEntity);

    expect(ctrl.enemyGraveyard.length).toBe(0);
    expect(ctrl.addLog).toHaveBeenCalled();
  });

  it('checkNullify: no Fallen One in opponent Limbo — cannot nullify from Graveyard', async () => {
    const fo = card({ name: 'Fallen One', power: 6, isEnemy: true });
    ctrl.enemyGraveyard.push(fo);

    const playerFlipper = card({ name: 'Herald', power: 5, isEnemy: false });

    const result = await ctrl.abilityManager.checkNullify(playerFlipper as unknown as CardEntity);

    expect(result).toBe(false);
  });
});
