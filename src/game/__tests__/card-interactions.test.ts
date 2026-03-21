/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for happy-path card interactions: combat, abilities, and immunity.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Alignment, Phase } from '../../types';
import type { CardData } from '../../types';
import { AbilityManager } from '../AbilityManager';
import { PhaseManager } from '../PhaseManager';
import type { CardEntity } from '../../entities/CardEntity';
import type { IGameController } from '../interfaces';

// Mock gsap so abilities that use gsap.to(..., onComplete) don't require real animations
vi.mock('gsap', () => ({
  default: {
    to: vi.fn((_target: unknown, _vars: { onComplete?: () => void }) => {
      const vars = _vars as { onComplete?: () => void };
      if (typeof vars?.onComplete === 'function') {
        vars.onComplete();
      }
    }),
  },
}));

/** Minimal card-like object for testing (no Three.js). */
interface MockCardLike {
  data: CardData & {
    isEnemy: boolean;
    faceUp: boolean;
    powerMarkers: number;
    weaknessMarkers: number;
    isInvincible?: boolean;
    isSuppressed?: boolean;
    markedByWildWolf?: boolean;
  };
  updateVisualMarkers: () => void;
  mesh: { position: { x: number; y: number; z: number } };
}

function createMockCard(
  overrides: Partial<MockCardLike['data']> & { name: string; power: number }
): MockCardLike {
  const data: MockCardLike['data'] = {
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
    mesh: { position: { x: 0, y: 0, z: 0 } },
  };
}

/** Build a mock controller that mutates battlefields when destroyCard is called (for combat tests). */
function createMockControllerForBattle(): IGameController & {
  destroyCard: ReturnType<typeof vi.fn>;
  addLog: ReturnType<typeof vi.fn>;
  playerBattlefield: (CardEntity | null)[];
  enemyBattlefield: (CardEntity | null)[];
  cardsThatBattledThisRound: CardEntity[];
} {
  const playerBattlefield: (CardEntity | null)[] = Array(7).fill(null);
  const enemyBattlefield: (CardEntity | null)[] = Array(7).fill(null);
  const addLog = vi.fn();
  const destroyCard = vi.fn((card: CardEntity, isEnemy: boolean, idx: number, _isChampion: boolean) => {
    if (isEnemy) {
      const i = enemyBattlefield.indexOf(card);
      if (i !== -1) enemyBattlefield[i] = null;
    } else {
      const i = playerBattlefield.indexOf(card);
      if (i !== -1) playerBattlefield[i] = null;
    }
  });

  const seals = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    champion: null as CardEntity | null,
    alignment: Alignment.NEUTRAL as Alignment,
    mesh: { position: { x: 0, y: 0, z: 0 } },
  }));

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

  const mock = {
    state,
    playerBattlefield,
    enemyBattlefield,
    playerHand: [] as CardEntity[],
    playerLimbo: [] as CardEntity[],
    enemyLimbo: [] as CardEntity[],
    playerGraveyard: [] as CardEntity[],
    enemyGraveyard: [] as CardEntity[],
    playerDeck: [] as CardData[],
    enemyDeck: [] as CardData[],
    enemyPrepRemainder: [] as CardData[],
    seals,
    playerLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    playerGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    sceneManager: { scene: {}, camera: { position: {} }, cameraTarget: {} },
    entityManager: { add: vi.fn(), remove: vi.fn() },
    abilityManager: null as unknown as AbilityManager,
    uiManager: {},
    phaseManager: null as unknown as PhaseManager,
    isProcessing: false,
    currentResolvingSealIndex: 0,
    sealCameraZoomedIn: false,
    cardsThatBattledThisRound: [] as CardEntity[],
    resolutionCallback: null as (() => void) | null,
    pendingAbilityData: null as unknown,
    nullifyCallback: null as ((c: boolean) => void) | null,
    sealSelectionCallback: null as ((idx: number) => void) | null,
    updateState: vi.fn((patch: Partial<typeof state>) => Object.assign(state, patch)),
    addLog,
    destroyCard,
    appendEnemyPrepCardsToLimbo: vi.fn(),
    allocateCounters: vi.fn(() => Promise.resolve()),
    handleTargetedAbility: vi.fn(() => Promise.resolve()),
    executeGlobalAbility: vi.fn(() => Promise.resolve()),
    handleSealTargetAbility: vi.fn(() => Promise.resolve()),
    claimSeal: vi.fn(() => Promise.resolve()),
    disposeCard: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    handleBattle: vi.fn(),
    handleSiege: vi.fn(() => Promise.resolve()),
    ascendToSeal: vi.fn(),
    checkGameOver: vi.fn(),
    startPrep: vi.fn(),
    endPrep: vi.fn(),
    startResolution: vi.fn(() => Promise.resolve()),
    resolveSeal: vi.fn(() => Promise.resolve()),
    forceSkip: vi.fn(),
    selectLimboCardForAbility: vi.fn(),
    isImmuneToAbilities: vi.fn(),
    isProtected: () => false,
  };

  mock.abilityManager = new AbilityManager(mock as IGameController);
  mock.phaseManager = new PhaseManager(mock as IGameController);
  mock.handleBattle = (a: CardEntity, d: CardEntity, idx: number, isChamp: boolean) =>
    mock.phaseManager.handleBattle(a, d, idx, isChamp);
  mock.isImmuneToAbilities = (target: CardEntity, source: CardEntity) =>
    mock.abilityManager.isImmuneToAbilities(target, source);

  return mock as ReturnType<typeof createMockControllerForBattle>;
}

/** Mock controller for ability-effect tests (destroy, return, place_power, etc.). */
function createMockControllerForAbilities(): IGameController & {
  destroyCard: ReturnType<typeof vi.fn>;
  addLog: ReturnType<typeof vi.fn>;
  playerBattlefield: (CardEntity | null)[];
  enemyBattlefield: (CardEntity | null)[];
  playerDeck: CardData[];
  enemyDeck: CardData[];
} {
  const playerBattlefield: (CardEntity | null)[] = Array(7).fill(null);
  const enemyBattlefield: (CardEntity | null)[] = Array(7).fill(null);
  const playerDeck: CardData[] = [];
  const enemyDeck: CardData[] = [];
  const addLog = vi.fn();
  const destroyCard = vi.fn((card: CardEntity, isEnemy: boolean, idx: number, _isChampion: boolean) => {
    if (isEnemy) {
      const i = enemyBattlefield.indexOf(card);
      if (i !== -1) enemyBattlefield[i] = null;
    } else {
      const i = playerBattlefield.indexOf(card);
      if (i !== -1) playerBattlefield[i] = null;
    }
  });

  const seals = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    champion: null as CardEntity | null,
    alignment: Alignment.NEUTRAL as Alignment,
    mesh: { position: { x: 0, y: 0, z: 0 } },
  }));

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

  const mockAbilities = {
    state,
    playerBattlefield,
    enemyBattlefield,
    playerHand: [] as CardEntity[],
    playerLimbo: [] as CardEntity[],
    enemyLimbo: [] as CardEntity[],
    playerGraveyard: [] as CardEntity[],
    enemyGraveyard: [] as CardEntity[],
    playerDeck,
    enemyDeck,
    enemyPrepRemainder: [] as CardData[],
    seals,
    playerLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    playerGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    sceneManager: { scene: {}, camera: { position: {} }, cameraTarget: {} },
    entityManager: { add: vi.fn(), remove: vi.fn() },
    abilityManager: null as unknown as AbilityManager,
    uiManager: {},
    phaseManager: {},
    isProcessing: false,
    currentResolvingSealIndex: 0,
    sealCameraZoomedIn: false,
    cardsThatBattledThisRound: [] as CardEntity[],
    resolutionCallback: null as (() => void) | null,
    pendingAbilityData: null as unknown,
    nullifyCallback: null as ((c: boolean) => void) | null,
    sealSelectionCallback: null as ((idx: number) => void) | null,
    updateState: vi.fn((patch: Partial<typeof state>) => Object.assign(state, patch)),
    addLog,
    destroyCard,
    appendEnemyPrepCardsToLimbo: vi.fn(),
    allocateCounters: vi.fn(() => Promise.resolve()),
    handleTargetedAbility: vi.fn(() => Promise.resolve()),
    executeGlobalAbility: vi.fn(() => Promise.resolve()),
    handleSealTargetAbility: vi.fn(() => Promise.resolve()),
    claimSeal: vi.fn(() => Promise.resolve()),
    disposeCard: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    handleBattle: vi.fn(() => Promise.resolve(false)),
    handleSiege: vi.fn(() => Promise.resolve()),
    ascendToSeal: vi.fn(),
    checkGameOver: vi.fn(),
    startPrep: vi.fn(),
    endPrep: vi.fn(),
    startResolution: vi.fn(() => Promise.resolve()),
    resolveSeal: vi.fn(() => Promise.resolve()),
    forceSkip: vi.fn(),
    selectLimboCardForAbility: vi.fn(),
    isImmuneToAbilities: vi.fn(),
    isProtected: () => false,
  };

  mockAbilities.abilityManager = new AbilityManager(mockAbilities as IGameController);
  mockAbilities.isImmuneToAbilities = (target: CardEntity, source: CardEntity) =>
    mockAbilities.abilityManager.isImmuneToAbilities(target, source);

  return mockAbilities as ReturnType<typeof createMockControllerForAbilities>;
}

describe('Combat – card vs card', () => {
  let mock: ReturnType<typeof createMockControllerForBattle>;

  beforeEach(() => {
    mock = createMockControllerForBattle();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.cardsThatBattledThisRound = [];
    vi.clearAllMocks();
  });

  it('higher power attacker wins: defender is destroyed, attacker survives', async () => {
    const attacker = createMockCard({ name: 'Alpha', power: 7, powerMarkers: 0, weaknessMarkers: 0, isEnemy: false }) as unknown as CardEntity;
    const defender = createMockCard({ name: 'Noble', power: 4, powerMarkers: 0, weaknessMarkers: 0, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = attacker;
    mock.enemyBattlefield[0] = defender;

    const stymied = await mock.phaseManager.handleBattle(attacker, defender, 0, false);

    expect(stymied).toBe(false);
    expect(mock.destroyCard).toHaveBeenCalledWith(
      defender,
      true,
      0,
      false,
      expect.objectContaining({ cardName: 'Alpha', cause: 'combat' })
    );
    expect(mock.playerBattlefield[0]).toBe(attacker);
    expect(mock.enemyBattlefield[0]).toBeNull();
  });

  it('higher power defender wins: attacker is destroyed, defender survives', async () => {
    const attacker = createMockCard({ name: 'Noble', power: 4, isEnemy: false }) as unknown as CardEntity;
    const defender = createMockCard({ name: 'War', power: 9, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = attacker;
    mock.enemyBattlefield[0] = defender;

    const stymied = await mock.phaseManager.handleBattle(attacker, defender, 0, false);

    expect(stymied).toBe(false);
    expect(mock.destroyCard).toHaveBeenCalledWith(
      attacker,
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'War', cause: 'combat' })
    );
    expect(mock.enemyBattlefield[0]).toBe(defender);
    expect(mock.playerBattlefield[0]).toBeNull();
  });

  it('equal power: mutual destruction (both destroyed)', async () => {
    const attacker = createMockCard({ name: 'Pride', power: 6, isEnemy: false }) as unknown as CardEntity;
    const defender = createMockCard({ name: 'Duke', power: 6, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = attacker;
    mock.enemyBattlefield[0] = defender;

    const stymied = await mock.phaseManager.handleBattle(attacker, defender, 0, false);

    expect(stymied).toBe(false);
    expect(mock.destroyCard).toHaveBeenCalledWith(attacker, false, 0, false, expect.any(Object));
    expect(mock.destroyCard).toHaveBeenCalledWith(defender, true, 0, false, expect.any(Object));
    expect(mock.playerBattlefield[0]).toBeNull();
    expect(mock.enemyBattlefield[0]).toBeNull();
  });

  it('Wrath cannot be destroyed by attacker with weakness markers (stymied)', async () => {
    const attacker = createMockCard({
      name: 'Pride',
      power: 8,
      weaknessMarkers: 1,
      isEnemy: false,
    }) as unknown as CardEntity;
    const defender = createMockCard({
      name: 'Wrath',
      power: 5,
      isEnemy: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = attacker;
    mock.enemyBattlefield[0] = defender;

    const stymied = await mock.phaseManager.handleBattle(attacker, defender, 0, false);

    expect(stymied).toBe(true);
    expect(mock.destroyCard).not.toHaveBeenCalled();
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('Wrath cannot be destroyed')
    );
  });

  it('Elder sends defeated creature to deck instead of destroying', async () => {
    const attacker = createMockCard({ name: 'Elder', power: 5, hasHaste: true, isEnemy: false }) as unknown as CardEntity;
    const defender = createMockCard({ name: 'Fledgeling', power: 1, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = attacker;
    mock.enemyBattlefield[0] = defender;

    await mock.phaseManager.handleBattle(attacker, defender, 0, false);

    expect(mock.destroyCard).not.toHaveBeenCalled();
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('placed on top of its owner\'s deck')
    );
  });

  it('Wild Wolf marks opponent for destruction at end of round', async () => {
    const wolf = createMockCard({ name: 'Wild Wolf', power: 1, hasHaste: true, isEnemy: false }) as unknown as CardEntity;
    const other = createMockCard({ name: 'Noble', power: 4, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = wolf;
    mock.enemyBattlefield[0] = other;

    await mock.phaseManager.handleBattle(wolf, other, 0, false);

    expect(other.data.markedByWildWolf).toBe(true);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/marks .* for destruction at end of round/)
    );
  });

  it('invincible defender is not destroyed (attacker stymied)', async () => {
    const attacker = createMockCard({ name: 'War', power: 9, isEnemy: false }) as unknown as CardEntity;
    const defender = createMockCard({
      name: 'Beta',
      power: 6,
      isEnemy: true,
      isInvincible: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = attacker;
    mock.enemyBattlefield[0] = defender;

    const stymied = await mock.phaseManager.handleBattle(attacker, defender, 0, false);

    expect(stymied).toBe(true);
    expect(mock.destroyCard).not.toHaveBeenCalled();
  });
});

describe('Post-combat – War and Alpha', () => {
  let mock: ReturnType<typeof createMockControllerForBattle>;

  beforeEach(() => {
    mock = createMockControllerForBattle();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    vi.clearAllMocks();
  });

  it('War gains +2 Power per Horseman in play after destroying a creature', async () => {
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      powerMarkers: 0,
      isEnemy: true,
    }) as unknown as CardEntity;
    const victim = createMockCard({ name: 'Herald', power: 5, isEnemy: false }) as unknown as CardEntity;
    const otherHorseman = createMockCard({
      name: 'Death',
      power: 9,
      type: 'Horseman',
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = war;
    mock.playerBattlefield[0] = victim;
    mock.enemyBattlefield[1] = otherHorseman;

    await mock.phaseManager.handleBattle(war, victim, 0, false);

    expect(war.data.powerMarkers).toBe(4);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/War gains .* Power Marker.*\+2 per Horseman/)
    );
  });

  it('Alpha gains +2 Power after destroying an enemy in battle', async () => {
    const alpha = createMockCard({
      name: 'Alpha',
      power: 7,
      hasHaste: true,
      powerMarkers: 0,
      isEnemy: false,
    }) as unknown as CardEntity;
    const victim = createMockCard({ name: 'Baron', power: 2, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = alpha;
    mock.enemyBattlefield[0] = victim;

    await mock.phaseManager.handleBattle(alpha, victim, 0, false);

    expect(alpha.data.powerMarkers).toBe(2);
    expect(mock.addLog).toHaveBeenCalledWith(expect.stringContaining('Alpha gains 2 Power Marker'));
  });

  it('Alpha power markers persist after ascending to seal (same card reference, markers not reset)', async () => {
    const alpha = createMockCard({
      name: 'Alpha',
      power: 7,
      hasHaste: true,
      powerMarkers: 0,
      isEnemy: false,
      isChampion: true,
    }) as unknown as CardEntity;
    const victim = createMockCard({ name: 'Baron', power: 2, isEnemy: true }) as unknown as CardEntity;
    mock.playerBattlefield[0] = alpha;
    mock.enemyBattlefield[0] = victim;

    await mock.phaseManager.handleBattle(alpha, victim, 0, false);
    expect(alpha.data.powerMarkers).toBe(2);

    mock.phaseManager.ascendToSeal(alpha, 0);

    expect(mock.seals[0].champion).toBe(alpha);
    expect(mock.seals[0].champion!.data.powerMarkers).toBe(2);
    expect(alpha.updateVisualMarkers).toHaveBeenCalled();
  });
});

describe('Pestilence – flip weakness by Horseman count', () => {
  let mock: ReturnType<typeof createMockControllerForBattle>;

  beforeEach(() => {
    vi.useFakeTimers();
    mock = createMockControllerForBattle();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.state.currentPhase = Phase.RESOLUTION;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function resolveSealWithFakeTimers(idx: number) {
    const p = mock.phaseManager.resolveSeal(idx);
    await vi.runAllTimersAsync();
    return p;
  }

  it('only Pestilence flipping still counts itself: -2 weakness per Horseman (1) on each enemy', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const enemyCreature = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.enemyBattlefield[0] = enemyCreature;

    await resolveSealWithFakeTimers(0);

    expect(enemyCreature.data.weaknessMarkers).toBe(2);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/Pestilence places -2 Weakness per Horseman \(1\).*\(2 total per creature\)/)
    );
  });

  it('Pestilence + one other face-up Horseman: 2 Horsemen → -4 weakness per enemy creature', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyCreature = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.enemyBattlefield[0] = enemyCreature;

    await resolveSealWithFakeTimers(0);

    expect(enemyCreature.data.weaknessMarkers).toBe(4);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/Pestilence places -2 Weakness per Horseman \(2\).*\(4 total per creature\)/)
    );
  });

  it('Pestilence + two other face-up Horsemen: 3 Horsemen → -6 weakness per enemy creature', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const death = createMockCard({
      name: 'Death',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyCreature = createMockCard({
      name: 'Noble',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.playerBattlefield[2] = death;
    mock.enemyBattlefield[0] = enemyCreature;

    await resolveSealWithFakeTimers(0);

    expect(enemyCreature.data.weaknessMarkers).toBe(6);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/Pestilence places -2 Weakness per Horseman \(3\).*\(6 total per creature\)/)
    );
  });

  it('Pestilence + three other face-up Horsemen: 4 Horsemen → -8 weakness per enemy creature', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const death = createMockCard({
      name: 'Death',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const famine = createMockCard({
      name: 'Famine',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyCreature = createMockCard({
      name: 'Baron',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.playerBattlefield[2] = death;
    mock.playerBattlefield[3] = famine;
    mock.enemyBattlefield[0] = enemyCreature;

    await resolveSealWithFakeTimers(0);

    expect(enemyCreature.data.weaknessMarkers).toBe(8);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/Pestilence places -2 Weakness per Horseman \(4\).*\(8 total per creature\)/)
    );
  });

  it('only face-up enemy creatures receive weakness; face-down enemy is unaffected', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const faceUpEnemy = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const faceDownEnemy = createMockCard({
      name: 'Noble',
      power: 4,
      isEnemy: true,
      faceUp: false,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.enemyBattlefield[0] = faceUpEnemy;
    mock.enemyBattlefield[1] = faceDownEnemy;

    await resolveSealWithFakeTimers(0);

    expect(faceUpEnemy.data.weaknessMarkers).toBe(4);
    expect(faceDownEnemy.data.weaknessMarkers).toBe(0);
  });

  it('applies weakness to all enemy creatures on the battlefield (multiple slots)', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemy0 = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const enemy1 = createMockCard({
      name: 'Noble',
      power: 4,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const enemy2 = createMockCard({
      name: 'Baron',
      power: 2,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.enemyBattlefield[0] = enemy0;
    mock.enemyBattlefield[1] = enemy1;
    mock.enemyBattlefield[2] = enemy2;

    await resolveSealWithFakeTimers(0);

    expect(enemy0.data.weaknessMarkers).toBe(4);
    expect(enemy1.data.weaknessMarkers).toBe(4);
    expect(enemy2.data.weaknessMarkers).toBe(4);
  });

  it('applies weakness to enemy champions on seals (ascended)', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyOnBattlefield = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const enemyChampionOnSeal = createMockCard({
      name: 'Wrath',
      power: 7,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.enemyBattlefield[0] = enemyOnBattlefield;
    mock.seals[1].champion = enemyChampionOnSeal;

    await resolveSealWithFakeTimers(0);

    expect(enemyOnBattlefield.data.weaknessMarkers).toBe(4);
    expect(enemyChampionOnSeal.data.weaknessMarkers).toBe(4);
  });

  it('applies weakness to enemies on battlefield and on multiple seals', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const death = createMockCard({
      name: 'Death',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyOnField = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const championOnSeal0 = createMockCard({
      name: 'Wrath',
      power: 7,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const championOnSeal3 = createMockCard({
      name: 'Pride',
      power: 6,
      isChampion: false,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.playerBattlefield[2] = death;
    mock.enemyBattlefield[0] = enemyOnField;
    mock.seals[0].champion = championOnSeal0;
    mock.seals[3].champion = championOnSeal3;

    await resolveSealWithFakeTimers(0);

    const amountPerCreature = 6;
    expect(enemyOnField.data.weaknessMarkers).toBe(amountPerCreature);
    expect(championOnSeal0.data.weaknessMarkers).toBe(amountPerCreature);
    expect(championOnSeal3.data.weaknessMarkers).toBe(amountPerCreature);
  });

  it('Pestilence (Horseman) affects Sloth: immunity only applies to Creature sources', async () => {
    const pestilence = createMockCard({
      name: 'Pestilence',
      power: 9,
      type: 'Horseman',
      isChampion: true,
      isEnemy: false,
      faceUp: false,
      weaknessMarkers: 0,
      powerMarkers: 0,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      power: 9,
      type: 'Horseman',
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const sloth = createMockCard({
      name: 'Sloth',
      power: 4,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
      abilityImmune: true,
      type: 'Creature',
    }) as unknown as CardEntity;
    const normalEnemy = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: true,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = pestilence;
    mock.playerBattlefield[1] = war;
    mock.enemyBattlefield[0] = sloth;
    mock.enemyBattlefield[1] = normalEnemy;

    await resolveSealWithFakeTimers(0);

    expect(sloth.data.weaknessMarkers).toBe(4);
    expect(normalEnemy.data.weaknessMarkers).toBe(4);
  });
});

describe('Nephilim – temporary invulnerability', () => {
  let mock: ReturnType<typeof createMockControllerForBattle>;

  beforeEach(() => {
    vi.useFakeTimers();
    mock = createMockControllerForBattle();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.state.currentPhase = Phase.RESOLUTION;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function resolveSealWithFakeTimers(idx: number) {
    const p = mock.phaseManager.resolveSeal(idx);
    await vi.runAllTimersAsync();
    return p;
  }

  it('grants Nephilim battle invulnerability on the round it flips', async () => {
    const nephilim = createMockCard({
      name: 'Nephilim',
      power: 5,
      type: 'Creature',
      isEnemy: false,
      faceUp: false,
      isInvincible: false,
    }) as unknown as CardEntity;
    const opponent = createMockCard({
      name: 'Noble',
      power: 4,
      type: 'Creature',
      isEnemy: true,
      faceUp: false,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = nephilim;
    mock.enemyBattlefield[0] = opponent;

    await resolveSealWithFakeTimers(0);

    expect(nephilim.data.isInvincible).toBe(true);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('Nephilim gains battle invulnerability this turn')
    );
  });

  it('clears Nephilim invulnerability at the start of the next round (prep phase)', async () => {
    const nephilim = createMockCard({
      name: 'Nephilim',
      power: 5,
      type: 'Creature',
      isEnemy: false,
      faceUp: false,
      isInvincible: false,
    }) as unknown as CardEntity;
    const opponent = createMockCard({
      name: 'Noble',
      power: 4,
      type: 'Creature',
      isEnemy: true,
      faceUp: false,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = nephilim;
    mock.enemyBattlefield[0] = opponent;

    // Round where Nephilim flips and gains invulnerability
    await resolveSealWithFakeTimers(0);
    expect(nephilim.data.isInvincible).toBe(true);

    // Start of next round: clearing temporary invincibility should remove the flag
    mock.phaseManager.clearTemporaryInvincibility();

    expect(nephilim.data.isInvincible).toBe(false);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining("Nephilim's Invulnerability fades.")
    );
  });
});

describe('Delta – NPC end-of-round +3 buff targeting', () => {
  let mock: ReturnType<typeof createMockControllerForBattle>;

  beforeEach(() => {
    mock = createMockControllerForBattle();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.seals.forEach((s) => ((s as { champion: CardEntity | null }).champion = null));
    vi.clearAllMocks();
  });

  it('NPC Delta sacrifices and buffs the strongest enemy ally on the battlefield', async () => {
    const delta = createMockCard({
      name: 'Delta',
      power: 3,
      type: 'Creature',
      isEnemy: true,
      faceUp: true,
      pendingDeltaSacrifice: true,
    }) as unknown as CardEntity;
    const weakerAlly = createMockCard({
      name: 'Weaker Ally',
      power: 2,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const strongerAlly = createMockCard({
      name: 'Stronger Ally',
      power: 5,
      powerMarkers: 1,
      weaknessMarkers: 0,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;

    mock.enemyBattlefield[0] = delta;
    mock.enemyBattlefield[1] = weakerAlly;
    mock.enemyBattlefield[2] = strongerAlly;

    await (mock.phaseManager as any).cleanupEndOfRoundEffects();

    // Delta should be sacrificed
    expect(mock.enemyBattlefield[0]).toBeNull();
    // Strongest ally (by effective power) receives +3
    expect(strongerAlly.data.powerMarkers).toBe(4);
    expect(weakerAlly.data.powerMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('Stronger Ally receives +3 Power Markers from Delta\'s sacrifice.')
    );
  });

  it('NPC Delta considers champions on seals and buffs the strongest enemy card overall', async () => {
    const delta = createMockCard({
      name: 'Delta',
      power: 3,
      type: 'Creature',
      isEnemy: true,
      faceUp: true,
      pendingDeltaSacrifice: true,
    }) as unknown as CardEntity;
    const battlefieldAlly = createMockCard({
      name: 'Field Ally',
      power: 4,
      powerMarkers: 0,
      weaknessMarkers: 1, // effective 3
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const championAlly = createMockCard({
      name: 'Seal Champion',
      power: 6,
      powerMarkers: 0,
      weaknessMarkers: 0, // effective 6 (strongest)
      isEnemy: true,
      faceUp: true,
      isChampion: true,
    }) as unknown as CardEntity;

    mock.enemyBattlefield[0] = delta;
    mock.enemyBattlefield[1] = battlefieldAlly;
    mock.seals[2].champion = championAlly;

    await (mock.phaseManager as any).cleanupEndOfRoundEffects();

    // Delta should be sacrificed
    expect(mock.enemyBattlefield[0]).toBeNull();
    // Strongest ally across battlefield and seals (championAlly) receives +3
    expect(championAlly.data.powerMarkers).toBe(3);
    expect(battlefieldAlly.data.powerMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('Seal Champion receives +3 Power Markers from Delta\'s sacrifice.')
    );
  });

  it('NPC Delta can buff itself when it is the only valid target', async () => {
    const delta = createMockCard({
      name: 'Delta',
      power: 3,
      type: 'Creature',
      isEnemy: true,
      faceUp: true,
      pendingDeltaSacrifice: true,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;

    mock.enemyBattlefield[0] = delta;

    await (mock.phaseManager as any).cleanupEndOfRoundEffects();

    expect(mock.enemyBattlefield[0]).toBeNull();
    expect(delta.data.powerMarkers).toBe(3);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('Delta receives +3 Power Markers from Delta\'s sacrifice.')
    );
  });
});

describe('AbilityManager – applyAbilityEffect', () => {
  let mock: ReturnType<typeof createMockControllerForAbilities>;

  beforeEach(() => {
    mock = createMockControllerForAbilities();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    vi.clearAllMocks();
  });

  it('destroy effect removes target from battlefield', () => {
    const source = createMockCard({ name: 'Famine', power: 9, isEnemy: true }) as unknown as CardEntity;
    const target = createMockCard({ name: 'Sentinel', power: 4, isEnemy: false }) as unknown as CardEntity;
    mock.playerBattlefield[2] = target;

    mock.abilityManager.applyAbilityEffect(target, { source, effect: 'destroy' });

    expect(mock.destroyCard).toHaveBeenCalledWith(target, false, 2, false, expect.any(Object));
    expect(mock.playerBattlefield[2]).toBeNull();
  });

  it('return effect places target on top of owner deck', () => {
    const source = createMockCard({ name: 'Cherubim', power: 4, isEnemy: false }) as unknown as CardEntity;
    const target = createMockCard({ name: 'Wrath', power: 7, isEnemy: true }) as unknown as CardEntity;
    mock.enemyBattlefield[1] = target;

    mock.abilityManager.applyAbilityEffect(target, { source, effect: 'return' });

    expect(mock.enemyBattlefield[1]).toBeNull();
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/places .* on top of its owner's deck/)
    );
  });

  it('place_power adds markers to target', () => {
    const source = createMockCard({
      name: 'Delta',
      power: 3,
      markerPower: 3,
      isEnemy: false,
    }) as unknown as CardEntity;
    const target = createMockCard({
      name: 'Omega',
      power: 5,
      powerMarkers: 0,
      isEnemy: false,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(target, {
      source,
      effect: 'place_power',
      markerPower: 3,
    });

    expect(target.data.powerMarkers).toBe(3);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('places +3 Power Marker')
    );
  });

  it('place_weakness adds weakness markers to target', () => {
    const source = createMockCard({
      name: 'Pride',
      power: 6,
      markerWeakness: 3,
      isEnemy: true,
    }) as unknown as CardEntity;
    const target = createMockCard({
      name: 'Alpha',
      power: 7,
      weaknessMarkers: 0,
      isEnemy: false,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(target, {
      source,
      effect: 'place_weakness',
      markerWeakness: 3,
    });

    expect(target.data.weaknessMarkers).toBe(3);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('-3 Weakness Marker')
    );
  });

  it('sentinel_absorb adds power markers equal to Limbo creature power', () => {
    const sentinel = createMockCard({
      name: 'Sentinel',
      power: 4,
      powerMarkers: 0,
      isEnemy: false,
    }) as unknown as CardEntity;
    const limboCreature = createMockCard({
      name: 'War',
      power: 9,
      isEnemy: false,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(limboCreature, {
      source: sentinel,
      effect: 'sentinel_absorb',
    });

    expect(sentinel.data.powerMarkers).toBe(9);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringContaining('gains 9 Power Markers from')
    );
  });

  it('Sloth is immune to place_weakness from another creature', () => {
    const source = createMockCard({
      name: 'Pride',
      power: 6,
      markerWeakness: 3,
      type: 'Creature',
      isEnemy: true,
    }) as unknown as CardEntity;
    const sloth = createMockCard({
      name: 'Sloth',
      power: 4,
      weaknessMarkers: 0,
      abilityImmune: true,
      isEnemy: false,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(sloth, {
      source,
      effect: 'place_weakness',
      markerWeakness: 3,
    });

    expect(sloth.data.weaknessMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/Sloth is immune to .*ability/)
    );
  });

  it('destroy_marker removes one Power Marker from target (used by The Destroyer / The Allotter)', () => {
    const source = createMockCard({ name: 'The Destroyer', power: 15, isEnemy: false }) as unknown as CardEntity;
    const target = createMockCard({
      name: 'Noble',
      power: 4,
      powerMarkers: 2,
      weaknessMarkers: 0,
      isEnemy: true,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(target, { source, effect: 'destroy_marker' });

    expect(target.data.powerMarkers).toBe(1);
    expect(target.data.weaknessMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys a Power Marker on/)
    );
    expect(target.updateVisualMarkers).toHaveBeenCalled();
  });

  it('destroy_marker removes one Weakness Marker when target has no Power Markers', () => {
    const source = createMockCard({ name: 'The Destroyer', power: 15, isEnemy: false }) as unknown as CardEntity;
    const target = createMockCard({
      name: 'Herald',
      power: 3,
      powerMarkers: 0,
      weaknessMarkers: 3,
      isEnemy: false,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(target, { source, effect: 'destroy_marker' });

    expect(target.data.powerMarkers).toBe(0);
    expect(target.data.weaknessMarkers).toBe(2);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys a Weakness Marker on/)
    );
    expect(target.updateVisualMarkers).toHaveBeenCalled();
  });

  it('destroy_marker logs when target has no markers', () => {
    const source = createMockCard({ name: 'The Destroyer', power: 15, isEnemy: false }) as unknown as CardEntity;
    const target = createMockCard({
      name: 'Baron',
      power: 2,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isEnemy: true,
    }) as unknown as CardEntity;

    mock.abilityManager.applyAbilityEffect(target, { source, effect: 'destroy_marker' });

    expect(target.data.powerMarkers).toBe(0);
    expect(target.data.weaknessMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/No markers to destroy on/)
    );
    expect(target.updateVisualMarkers).toHaveBeenCalled();
  });
});

describe('The Destroyer – handleActivateAbility (player vs NPC)', () => {
  let mock: ReturnType<typeof createMockControllerForAbilities>;

  beforeEach(() => {
    mock = createMockControllerForAbilities();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.seals.forEach((s) => ((s as { champion: CardEntity | null }).champion = null));
    vi.clearAllMocks();
  });

  it('when played from player hand (isEnemy: false): shows marker-type dialog then destroys all markers of chosen type', async () => {
    const destroyer = createMockCard({
      name: 'The Destroyer',
      power: 15,
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const cardWithPower = createMockCard({
      name: 'Noble',
      power: 4,
      powerMarkers: 2,
      weaknessMarkers: 0,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyWithPower = createMockCard({
      name: 'Baron',
      power: 2,
      powerMarkers: 1,
      weaknessMarkers: 0,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = destroyer;
    mock.playerBattlefield[1] = cardWithPower;
    mock.enemyBattlefield[0] = enemyWithPower;

    const activated = mock.abilityManager.handleActivateAbility(destroyer, false);
    await Promise.resolve();
    (mock as unknown as { markerTypeCallback: ((t: 'power' | 'weakness') => void) | null }).markerTypeCallback!('power');
    await activated;

    expect(mock.updateState).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionContext: 'DESTROYER_MARKER_TYPE',
        instructionText: expect.stringMatching(/Choose which marker type to eliminate/),
      })
    );
    expect(mock.zoomOut).toHaveBeenCalled();
    expect(cardWithPower.data.powerMarkers).toBe(0);
    expect(enemyWithPower.data.powerMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys all Power Markers in play \(3 removed\)/)
    );
  });

  it('when NPC owns the card (isAI: true) and no cards have markers: destroys all of chosen type (0 removed), no UI', async () => {
    const destroyer = createMockCard({
      name: 'The Destroyer',
      power: 15,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const enemyCard = createMockCard({
      name: 'Baron',
      power: 2,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = destroyer;
    mock.enemyBattlefield[1] = enemyCard;

    await mock.abilityManager.handleActivateAbility(destroyer, true);

    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys all (Power|Weakness) Markers in play \(0 removed\)/)
    );
    expect(mock.updateState).not.toHaveBeenCalledWith(
      expect.objectContaining({ currentPhase: Phase.ABILITY_TARGETING })
    );
  });

  it('when NPC owns the card (isAI: true) and cards have Power Markers: AI destroys all Power markers', async () => {
    const destroyer = createMockCard({
      name: 'The Destroyer',
      power: 15,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const targetWithMarkers = createMockCard({
      name: 'Noble',
      power: 4,
      powerMarkers: 2,
      weaknessMarkers: 0,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = destroyer;
    mock.playerBattlefield[0] = targetWithMarkers;

    await mock.abilityManager.handleActivateAbility(destroyer, true);

    expect(targetWithMarkers.data.powerMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys all Power Markers in play \(2 removed\)/)
    );
  });

  it('when NPC owns the card (isAI: true) and only Weakness Markers exist: AI destroys all Weakness markers', async () => {
    const destroyer = createMockCard({
      name: 'The Destroyer',
      power: 15,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const targetWithWeakness = createMockCard({
      name: 'Herald',
      power: 3,
      powerMarkers: 0,
      weaknessMarkers: 2,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = destroyer;
    mock.playerBattlefield[0] = targetWithWeakness;

    await mock.abilityManager.handleActivateAbility(destroyer, true);

    expect(targetWithWeakness.data.weaknessMarkers).toBe(0);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys all Weakness Markers in play \(2 removed\)/)
    );
  });
});

describe('The Inevitable – post-combat ability origin (player vs AI)', () => {
  let mock: ReturnType<typeof createMockControllerForAbilities>;

  beforeEach(() => {
    mock = createMockControllerForAbilities();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.seals.forEach((s) => ((s as { champion: CardEntity | null }).champion = null));
    vi.clearAllMocks();
  });

  it('when player owns The Inevitable (played from player hand): enters ABILITY_TARGETING so human chooses target', async () => {
    const inevitable = createMockCard({
      name: 'The Inevitable',
      power: 9,
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    const other = createMockCard({
      name: 'Noble',
      power: 4,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = inevitable;
    mock.enemyBattlefield[0] = other;

    const postCombatPromise = mock.abilityManager.handlePostCombat(inevitable);
    // Human has not chosen yet: updateState and pendingAbilityData should be set for human UI
    expect(mock.updateState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: 'The Inevitable: Select a card or a card with Markers to destroy (card or one Marker).',
      })
    );
    expect(mock.zoomOut).toHaveBeenCalled();
    const pending = (mock as unknown as { pendingAbilityData: unknown }).pendingAbilityData;
    expect(pending).toEqual(
      expect.objectContaining({
        source: inevitable,
        effect: 'destroy_or_marker',
        targetType: 'any',
      })
    );
    // Resolve the promise (simulating user picking a target later)
    (mock as unknown as { resolutionCallback: (() => void) | null }).resolutionCallback!();
    await postCombatPromise;
  });

  it('when AI owns The Inevitable (played from AI hand): AI picks target immediately, no human prompt', async () => {
    const inevitable = createMockCard({
      name: 'The Inevitable',
      power: 9,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const targetWithMarker = createMockCard({
      name: 'Noble',
      power: 4,
      powerMarkers: 2,
      weaknessMarkers: 0,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = inevitable;
    mock.playerBattlefield[0] = targetWithMarker;

    // Deterministic: ensure AI selects the player creature (index 0 in allBoard)
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    await mock.abilityManager.handlePostCombat(inevitable);
    randSpy.mockRestore();

    // AI path: no ABILITY_TARGETING for human, ability was applied by AI
    expect(mock.updateState).not.toHaveBeenCalledWith(
      expect.objectContaining({ currentPhase: Phase.ABILITY_TARGETING })
    );
    // Effect was applied (e.g. one Power Marker removed from target)
    expect(targetWithMarker.data.powerMarkers).toBe(1);
    expect(mock.addLog).toHaveBeenCalledWith(
      expect.stringMatching(/destroys a Power Marker on/)
    );
  });

  it('when AI owns The Inevitable and target has no markers: AI destroys the card', async () => {
    const inevitable = createMockCard({
      name: 'The Inevitable',
      power: 9,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const targetNoMarkers = createMockCard({
      name: 'Herald',
      power: 5,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = inevitable;
    mock.playerBattlefield[0] = targetNoMarkers;

    // Deterministic: ensure AI selects the player creature (index 0 in allBoard)
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    await mock.abilityManager.handlePostCombat(inevitable);
    randSpy.mockRestore();

    expect(mock.destroyCard).toHaveBeenCalledWith(
      targetNoMarkers,
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'The Inevitable', cause: 'ability' })
    );
    expect(mock.playerBattlefield[0]).toBeNull();
  });

  it('when player owns The Inevitable, ability source in pendingAbilityData is the winner card', async () => {
    const inevitable = createMockCard({
      name: 'The Inevitable',
      power: 9,
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = inevitable;
    mock.playerBattlefield[1] = createMockCard({
      name: 'Beta',
      power: 6,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;

    mock.abilityManager.handlePostCombat(inevitable);
    const pending = (mock as unknown as { pendingAbilityData: { source: CardEntity } }).pendingAbilityData;
    expect(pending.source).toBe(inevitable);
    expect(pending.source.data.name).toBe('The Inevitable');
    expect(pending.source.data.isEnemy).toBe(false);
    (mock as unknown as { resolutionCallback: (() => void) | null }).resolutionCallback!();
  });
});

describe('AbilityManager – immunity and counts', () => {
  let mock: ReturnType<typeof createMockControllerForAbilities>;

  beforeEach(() => {
    mock = createMockControllerForAbilities();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.seals.forEach((s) => ((s as { champion: CardEntity | null }).champion = null));
    vi.clearAllMocks();
  });

  it('isImmuneToAbilities: Sloth is immune to creature abilities', () => {
    const sloth = createMockCard({
      name: 'Sloth',
      abilityImmune: true,
      type: 'Creature',
      isEnemy: false,
    }) as unknown as CardEntity;
    const source = createMockCard({ name: 'Pride', type: 'Creature', isEnemy: true }) as unknown as CardEntity;

    expect(mock.abilityManager.isImmuneToAbilities(sloth, source)).toBe(true);
  });

  it('isImmuneToAbilities: non-Sloth creature is not immune by default', () => {
    const target = createMockCard({ name: 'Noble', type: 'Creature', isEnemy: false }) as unknown as CardEntity;
    const source = createMockCard({ name: 'Famine', type: 'Horseman', isEnemy: true }) as unknown as CardEntity;

    expect(mock.abilityManager.isImmuneToAbilities(target, source)).toBe(false);
  });

  it('countHorsemenInPlay counts only flipped Horsemen on owner side', () => {
    const war = createMockCard({
      name: 'War',
      type: 'Horseman',
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const death = createMockCard({
      name: 'Death',
      type: 'Horseman',
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = war;
    mock.enemyBattlefield[1] = death;

    const count = mock.abilityManager.countHorsemenInPlay(true);
    expect(count).toBe(2);
  });

  it('countHorsemenForPestilenceFlip counts face-down flipping Pestilence plus face-up Horsemen', () => {
    const pest = createMockCard({
      name: 'Pestilence',
      type: 'Horseman',
      isEnemy: true,
      faceUp: false,
    }) as unknown as CardEntity;
    const war = createMockCard({
      name: 'War',
      type: 'Horseman',
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[1] = war;
    expect(mock.abilityManager.countHorsemenInPlay(true)).toBe(1);
    expect(mock.abilityManager.countHorsemenForPestilenceFlip(true, pest)).toBe(2);
  });

  it('countHorsemenForPestilenceFlip does not add +1 if source Horseman is already face-up (no double count)', () => {
    const pest = createMockCard({
      name: 'Pestilence',
      type: 'Horseman',
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = pest;
    expect(mock.abilityManager.countHorsemenForPestilenceFlip(true, pest)).toBe(1);
  });
});

describe('AbilityManager – enforceZeroPowerDestruction (markers can kill any creature)', () => {
  let mock: ReturnType<typeof createMockControllerForAbilities>;

  beforeEach(() => {
    mock = createMockControllerForAbilities();
    mock.playerBattlefield.fill(null);
    mock.enemyBattlefield.fill(null);
    mock.seals.forEach((s) => ((s as { champion: CardEntity | null }).champion = null));
    vi.clearAllMocks();
  });

  it('destroys a player creature on battlefield when effective power is reduced to 0 by weakness markers', () => {
    const creature = createMockCard({
      name: 'Test Creature',
      power: 3,
      powerMarkers: 0,
      weaknessMarkers: 3,
      isEnemy: false,
      type: 'Creature',
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = creature;

    mock.abilityManager.enforceZeroPowerDestruction();

    expect(mock.destroyCard).toHaveBeenCalledWith(
      creature,
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'Markers', cause: 'ability' })
    );
    expect(mock.playerBattlefield[0]).toBeNull();
  });

  it('destroys an enemy creature on battlefield when effective power is negative', () => {
    const enemyCreature = createMockCard({
      name: 'Enemy Creature',
      power: 2,
      powerMarkers: 0,
      weaknessMarkers: 5,
      isEnemy: true,
      type: 'Creature',
    }) as unknown as CardEntity;
    mock.enemyBattlefield[1] = enemyCreature;

    mock.abilityManager.enforceZeroPowerDestruction();

    expect(mock.destroyCard).toHaveBeenCalledWith(
      enemyCreature,
      true,
      1,
      false,
      expect.objectContaining({ cardName: 'Markers', cause: 'ability' })
    );
    expect(mock.enemyBattlefield[1]).toBeNull();
  });

  it('destroys a champion creature on a seal when effective power is 0', () => {
    const champ = createMockCard({
      name: 'Seal Champion',
      power: 4,
      powerMarkers: 1,
      weaknessMarkers: 5,
      isEnemy: false,
      type: 'Creature',
      isChampion: true,
    }) as unknown as CardEntity;
    mock.seals[2].champion = champ;

    mock.abilityManager.enforceZeroPowerDestruction();

    expect(mock.destroyCard).toHaveBeenCalledWith(
      champ,
      false,
      2,
      true,
      expect.objectContaining({ cardName: 'Markers', cause: 'ability' })
    );
    expect(mock.seals[2].champion).toBeNull();
  });

  it('ignores non-creature cards even if their effective power is 0 or less', () => {
    const avatar = createMockCard({
      name: 'Avatar Card',
      power: 5,
      powerMarkers: 0,
      weaknessMarkers: 10,
      isEnemy: false,
      type: 'Avatar',
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = avatar;

    mock.abilityManager.enforceZeroPowerDestruction();

    expect(mock.destroyCard).not.toHaveBeenCalled();
    expect(mock.playerBattlefield[0]).toBe(avatar);
  });

  it('destroys a creature even if it is currently battle-invincible', () => {
    const invincibleCreature = createMockCard({
      name: 'Invincible Creature',
      power: 4,
      powerMarkers: 0,
      weaknessMarkers: 5,
      isEnemy: false,
      type: 'Creature',
      isInvincible: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = invincibleCreature;

    mock.abilityManager.enforceZeroPowerDestruction();

    expect(mock.destroyCard).toHaveBeenCalledWith(
      invincibleCreature,
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'Markers', cause: 'ability' })
    );
    expect(mock.playerBattlefield[0]).toBeNull();
  });
});

/** Mock controller for Lust tests: supports alignment choice callback when LUST_SEAL_INFLUENCE is set. */
function createMockControllerForLust(chosenAlignment: Alignment): IGameController & {
  destroyCard: ReturnType<typeof vi.fn>;
  addLog: ReturnType<typeof vi.fn>;
  claimSeal: ReturnType<typeof vi.fn>;
  updateState: ReturnType<typeof vi.fn>;
  playerBattlefield: (CardEntity | null)[];
  enemyBattlefield: (CardEntity | null)[];
  seals: { index: number; champion: CardEntity | null; alignment: Alignment; mesh: { position: { x: number; y: number; z: number } } }[];
} {
  const playerBattlefield: (CardEntity | null)[] = Array(7).fill(null);
  const enemyBattlefield: (CardEntity | null)[] = Array(7).fill(null);
  const addLog = vi.fn();
  const destroyCard = vi.fn((card: CardEntity, isEnemy: boolean, idx: number, _isChampion: boolean) => {
    if (isEnemy) {
      const i = enemyBattlefield.indexOf(card);
      if (i !== -1) enemyBattlefield[i] = null;
    } else {
      const i = playerBattlefield.indexOf(card);
      if (i !== -1) playerBattlefield[i] = null;
    }
  });
  const claimSeal = vi.fn(() => Promise.resolve());

  const seals = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    champion: null as CardEntity | null,
    alignment: Alignment.NEUTRAL as Alignment,
    mesh: { position: { x: 0, y: 0, z: 0 } },
  }));

  const state = {
    playerAlignment: Alignment.LIGHT,
    currentRound: 1,
    currentPhase: Phase.RESOLUTION,
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

  const updateState = vi.fn((patch: Partial<typeof state>) => {
    Object.assign(state, patch);
    if (patch.decisionContext === 'LUST_SEAL_INFLUENCE') {
      setTimeout(() => {
        const cb = (mock as any).alignmentChoiceCallback;
        if (cb) cb(chosenAlignment);
      }, 0);
    }
  });

  const mock = {
    state,
    playerBattlefield,
    enemyBattlefield,
    playerHand: [] as CardEntity[],
    playerLimbo: [] as CardEntity[],
    enemyLimbo: [] as CardEntity[],
    playerGraveyard: [] as CardEntity[],
    enemyGraveyard: [] as CardEntity[],
    playerDeck: [] as CardData[],
    enemyDeck: [] as CardData[],
    enemyPrepRemainder: [] as CardData[],
    seals,
    playerLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyLimboMesh: { position: { x: 0, y: 0, z: 0 } },
    playerGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    enemyGraveyardMesh: { position: { x: 0, y: 0, z: 0 } },
    sceneManager: { scene: {}, camera: { position: {} }, cameraTarget: {} },
    entityManager: { add: vi.fn(), remove: vi.fn() },
    abilityManager: null as unknown as AbilityManager,
    uiManager: {},
    phaseManager: null as unknown as PhaseManager,
    isProcessing: false,
    currentResolvingSealIndex: 0,
    sealCameraZoomedIn: false,
    cardsThatBattledThisRound: [] as CardEntity[],
    resolutionCallback: null as (() => void) | null,
    pendingAbilityData: null as unknown,
    nullifyCallback: null as ((c: boolean) => void) | null,
    sealSelectionCallback: null as ((idx: number) => void) | null,
    updateState,
    addLog,
    destroyCard,
    appendEnemyPrepCardsToLimbo: vi.fn(),
    allocateCounters: vi.fn(() => Promise.resolve()),
    handleTargetedAbility: vi.fn(() => Promise.resolve()),
    executeGlobalAbility: vi.fn(() => Promise.resolve()),
    handleSealTargetAbility: vi.fn(() => Promise.resolve()),
    claimSeal,
    disposeCard: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    handleBattle: vi.fn(() => Promise.resolve(false)),
    handleSiege: vi.fn(() => Promise.resolve()),
    ascendToSeal: vi.fn(),
    checkGameOver: vi.fn(),
    startPrep: vi.fn(),
    endPrep: vi.fn(),
    startResolution: vi.fn(() => Promise.resolve()),
    resolveSeal: vi.fn(() => Promise.resolve()),
    forceSkip: vi.fn(),
    selectLimboCardForAbility: vi.fn(),
    isImmuneToAbilities: vi.fn(),
    isProtected: () => false,
  };

  mock.abilityManager = new AbilityManager(mock as IGameController);
  mock.phaseManager = new PhaseManager(mock as IGameController);
  mock.isImmuneToAbilities = (target: CardEntity, source: CardEntity) =>
    mock.abilityManager.isImmuneToAbilities(target, source);

  return mock as ReturnType<typeof createMockControllerForLust>;
}

describe('Lust – seal influence', () => {
  it('happy path: player Lust and opponent at same seal, no champion – both sacrificed and claimSeal called with chosen alignment (Dark)', async () => {
    const mock = createMockControllerForLust(Alignment.DARK);
    mock.state.currentPhase = Phase.RESOLUTION;
    const lust = createMockCard({
      name: 'Lust',
      power: 2,
      hasLustSealEffect: true,
      isEnemy: false,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const opponent = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = lust;
    mock.enemyBattlefield[0] = opponent;
    mock.seals[0].champion = null;
    mock.seals[0].alignment = Alignment.NEUTRAL;

    await mock.phaseManager.resolveSeal(0);

    expect(mock.destroyCard).toHaveBeenCalledTimes(2);
    expect(mock.destroyCard).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Lust' }) }),
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'Lust', cause: 'ability' })
    );
    expect(mock.destroyCard).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Herald' }) }),
      true,
      0,
      false,
      expect.objectContaining({ cardName: 'Lust', cause: 'ability' })
    );
    expect(mock.updateState).toHaveBeenCalledWith(
      expect.objectContaining({ decisionContext: 'LUST_SEAL_INFLUENCE', sealIndexForChoice: 0 })
    );
    expect(mock.claimSeal).toHaveBeenCalledWith(
      0,
      Alignment.DARK,
      expect.objectContaining({ type: 'ability', cardName: 'Lust' })
    );
  });

  it('NPC Lust: seal influence is set to NPC alignment (no player choice)', async () => {
    const mock = createMockControllerForLust(Alignment.DARK);
    mock.state.currentPhase = Phase.RESOLUTION;
    // For this test, Lust is controlled by the enemy (NPC)
    const lust = createMockCard({
      name: 'Lust',
      power: 2,
      hasLustSealEffect: true,
      isEnemy: true,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const opponent = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: false,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    mock.enemyBattlefield[0] = lust;
    mock.playerBattlefield[0] = opponent;
    mock.seals[0].champion = null;
    mock.seals[0].alignment = Alignment.NEUTRAL;

    await mock.phaseManager.resolveSeal(0);

    // Lust and opponent should both be sacrificed
    expect(mock.destroyCard).toHaveBeenCalledTimes(2);
    expect(mock.destroyCard).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Lust' }) }),
      true,
      0,
      false,
      expect.objectContaining({ cardName: 'Lust', cause: 'ability' })
    );
    expect(mock.destroyCard).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Herald' }) }),
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'Lust', cause: 'ability' })
    );

    // No player choice dialog should be shown for NPC Lust
    expect(mock.updateState).not.toHaveBeenCalledWith(
      expect.objectContaining({ decisionContext: 'LUST_SEAL_INFLUENCE' })
    );

    // Seal influence should be set to the enemy (NPC) alignment (opposite of player)
    const pAlign = mock.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    expect(mock.claimSeal).toHaveBeenCalledWith(
      0,
      eAlign,
      expect.objectContaining({ type: 'ability', cardName: 'Lust' })
    );
  });

  it('edge case: seal has champion – Lust sacrifices both but does not offer seal influence', async () => {
    const mock = createMockControllerForLust(Alignment.DARK);
    mock.state.currentPhase = Phase.RESOLUTION;
    const lust = createMockCard({
      name: 'Lust',
      power: 2,
      hasLustSealEffect: true,
      isEnemy: false,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const opponent = createMockCard({
      name: 'Herald',
      power: 3,
      isEnemy: true,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
    }) as unknown as CardEntity;
    const champion = createMockCard({
      name: 'Prophet',
      power: 9,
      isChampion: true,
      isEnemy: false,
      faceUp: true,
    }) as unknown as CardEntity;
    mock.playerBattlefield[0] = lust;
    mock.enemyBattlefield[0] = opponent;
    mock.seals[0].champion = champion;
    mock.seals[0].alignment = Alignment.LIGHT;

    await mock.phaseManager.resolveSeal(0);

    expect(mock.destroyCard).toHaveBeenCalledTimes(2);
    expect(mock.destroyCard).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Lust' }) }),
      false,
      0,
      false,
      expect.objectContaining({ cardName: 'Lust', cause: 'ability' })
    );
    expect(mock.destroyCard).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Herald' }) }),
      true,
      0,
      false,
      expect.objectContaining({ cardName: 'Lust', cause: 'ability' })
    );
    expect(mock.claimSeal).not.toHaveBeenCalled();
    expect(mock.updateState).not.toHaveBeenCalledWith(
      expect.objectContaining({ decisionContext: 'LUST_SEAL_INFLUENCE' })
    );
  });
});
