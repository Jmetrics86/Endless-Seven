/**
 * Board-count Power Markers: The Spinner (faction), Omega (Lycan), Hades (Horsemen).
 * War / Lord use different rules (+ per event / activate) and are covered elsewhere.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Alignment, Phase } from '../../types';
import type { CardData } from '../../types';
import { AbilityManager } from '../AbilityManager';
import type { CardEntity } from '../../entities/CardEntity';
import type { IGameController } from '../interfaces';

vi.mock('gsap', () => ({
  default: { to: vi.fn((_t: unknown, v: { onComplete?: () => void }) => v.onComplete?.()) },
}));

interface MockCard {
  data: CardData & {
    isEnemy: boolean;
    faceUp: boolean;
    powerMarkers: number;
    weaknessMarkers: number;
    boardPresencePowerMarkers?: number;
  };
  updateVisualMarkers: () => void;
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
  return { data, updateVisualMarkers: vi.fn() };
}

function createCtrl() {
  const playerBattlefield: (MockCard | null)[] = Array(7).fill(null);
  const enemyBattlefield: (MockCard | null)[] = Array(7).fill(null);
  const seals = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    champion: null as MockCard | null,
    alignment: Alignment.NEUTRAL,
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
    playerHand: [] as MockCard[],
    playerLimbo: [] as MockCard[],
    enemyLimbo: [] as MockCard[],
    playerGraveyard: [] as MockCard[],
    enemyGraveyard: [] as MockCard[],
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
    cardsThatBattledThisRound: [] as MockCard[],
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

describe('syncBoardPresencePowerMarkers', () => {
  let ctrl: ReturnType<typeof createCtrl>;

  beforeEach(() => {
    ctrl = createCtrl();
  });

  it('The Spinner: markers equal face-up cards sharing faction (no double-count on repeated sync)', () => {
    const spinner = card({
      name: 'The Spinner',
      faction: 'Light',
      type: 'Avatar',
      power: 9,
      isChampion: true,
      hasActivate: true,
    }) as unknown as CardEntity;
    const ally = card({
      name: 'Archangel',
      faction: 'Light',
      type: 'Creature',
      power: 2,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.seals[0].champion = spinner as unknown as MockCard;
    ctrl.playerBattlefield[1] = ally as unknown as MockCard;

    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(spinner.data.powerMarkers).toBe(2);
    expect(spinner.data.boardPresencePowerMarkers).toBe(2);

    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(spinner.data.powerMarkers).toBe(2);

    const ally2 = card({
      name: 'Martyr',
      faction: 'Light',
      type: 'Avatar',
      power: 9,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.playerBattlefield[2] = ally2 as unknown as MockCard;
    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(spinner.data.powerMarkers).toBe(3);
    expect(spinner.data.boardPresencePowerMarkers).toBe(3);
  });

  it('Omega: counts face-up Lycans in play plus all Lycans in either Limbo', () => {
    const omega = card({
      name: 'Omega',
      faction: 'Lycan',
      type: 'Creature',
      power: 5,
      faceUp: true,
    }) as unknown as CardEntity;
    const wolf = card({
      name: 'Wild Wolf',
      faction: 'Lycan',
      type: 'Creature',
      power: 1,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.playerBattlefield[0] = omega as unknown as MockCard;
    ctrl.enemyBattlefield[1] = wolf as unknown as MockCard;
    const limboLycan = card({
      name: 'Beta',
      faction: 'Lycan',
      type: 'Creature',
      power: 6,
    }) as unknown as MockCard;
    ctrl.playerLimbo.push(limboLycan);

    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(omega.data.powerMarkers).toBe(3);
    ctrl.playerLimbo.pop();
    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(omega.data.powerMarkers).toBe(2);
  });

  it('Hades: +2 Power per face-up Horseman on that side', () => {
    const hades = card({
      name: 'Hades',
      faction: 'Darkness',
      type: 'Avatar',
      power: 9,
      isChampion: true,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const war = card({
      name: 'War',
      faction: 'Darkness',
      type: 'Horseman',
      power: 9,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.seals[3].champion = hades as unknown as MockCard;
    ctrl.enemyBattlefield[0] = war as unknown as MockCard;

    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(hades.data.powerMarkers).toBe(2);

    const famine = card({
      name: 'Famine',
      faction: 'Darkness',
      type: 'Horseman',
      power: 9,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.enemyBattlefield[1] = famine as unknown as MockCard;
    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(hades.data.powerMarkers).toBe(4);
  });

  it('stripBoardPresencePowerFromCard removes tracked portion before leaving play', () => {
    const omega = card({
      name: 'Omega',
      faction: 'Lycan',
      type: 'Creature',
      power: 5,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.playerBattlefield[0] = omega as unknown as MockCard;
    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    omega.data.powerMarkers += 5;
    expect(omega.data.powerMarkers).toBe(6);

    ctrl.abilityManager.stripBoardPresencePowerFromCard(omega);
    expect(omega.data.powerMarkers).toBe(5);
    expect(omega.data.boardPresencePowerMarkers).toBe(0);
  });

  it('afterBulkPowerMarkersCleared restores Spinner presence after Greed-style wipe', () => {
    const spinner = card({
      name: 'The Spinner',
      faction: 'Light',
      type: 'Avatar',
      power: 9,
      isChampion: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const ally = card({
      name: 'Prophet',
      faction: 'Light',
      type: 'Avatar',
      power: 9,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.seals[0].champion = spinner as unknown as MockCard;
    ctrl.playerBattlefield[1] = ally as unknown as MockCard;

    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    spinner.data.powerMarkers += 10;
    spinner.data.boardPresencePowerMarkers = 0;

    [spinner, ally].forEach((c) => {
      c.data.powerMarkers = 0;
    });
    ctrl.abilityManager.afterBulkPowerMarkersCleared();

    expect(spinner.data.powerMarkers).toBe(2);
    expect(spinner.data.boardPresencePowerMarkers).toBe(2);
  });
});

describe('Lord Activate (+1 per Vampyre, separate from board-presence sync)', () => {
  it('each Activate stacks markers from current Vampyre count; sync does not reset Lord', async () => {
    const ctrl = createCtrl();
    const lord = card({
      name: 'Lord',
      faction: 'Vampyre',
      type: 'Creature',
      power: 7,
      isChampion: true,
      hasTargetedAbility: true,
      hasActivate: true,
      faceUp: true,
    }) as unknown as CardEntity;
    const noble = card({
      name: 'Noble',
      faction: 'Vampyre',
      type: 'Creature',
      power: 4,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.playerBattlefield[0] = lord as unknown as MockCard;
    ctrl.playerBattlefield[1] = noble as unknown as MockCard;

    await ctrl.abilityManager.handleActivateAbility(lord, true);
    expect(lord.data.powerMarkers).toBe(2);
    await ctrl.abilityManager.handleActivateAbility(lord, true);
    expect(lord.data.powerMarkers).toBe(4);

    ctrl.abilityManager.syncBoardPresencePowerMarkers();
    expect(lord.data.powerMarkers).toBe(4);
  });
});

describe('War post-combat (event-based, not board-presence tracked)', () => {
  it('War still gains +2 per Horseman on each win via handlePostCombat', async () => {
    const ctrl = createCtrl();
    const war = card({
      name: 'War',
      type: 'Horseman',
      faction: 'Darkness',
      power: 9,
      isEnemy: true,
      isChampion: true,
    }) as unknown as CardEntity;
    const other = card({
      name: 'Death',
      type: 'Horseman',
      faction: 'Darkness',
      power: 9,
      isEnemy: true,
      faceUp: true,
    }) as unknown as CardEntity;
    ctrl.enemyBattlefield[0] = war as unknown as MockCard;
    ctrl.enemyBattlefield[1] = other as unknown as MockCard;

    await ctrl.abilityManager.handlePostCombat(war);
    expect(war.data.powerMarkers).toBe(4);
    await ctrl.abilityManager.handlePostCombat(war);
    expect(war.data.powerMarkers).toBe(8);
  });
});
