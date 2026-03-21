/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { SceneManager } from '../engine/SceneManager';
import { InputHandler } from '../engine/InputHandler';
import { EntityManager } from '../engine/EntityManager';
import { CardEntity } from '../entities/CardEntity';
import { SealEntity } from '../entities/SealEntity';
import { Alignment, Phase, CardData, GameState, HoveredCardInfo } from '../types';
import { LIGHT_POOL, DARK_POOL, GAME_CONSTANTS } from '../constants';
import type { EnvironmentTheme } from '../theme';
import { ENV_THEME_COLORS } from '../theme';
import { CARD_ART_PATHS, CARD_BACK_PATH, cardArtUrl } from '../cardArtPaths';
import { UIManager } from './UIManager';
import { AbilityManager } from './AbilityManager';
import { PhaseManager } from './PhaseManager';
import { IGameController } from './interfaces';

/** Temporary: zone/label tuning. Remove ZoneTuningGui and use final values in createPile/setupPiles when done. */
export interface ZoneTuningParams {
  labelWidth: number;
  labelHeight: number;
  labelOffsetZ: number;
  deckX: number;
  deckZ: number;
  deckY: number;
  limboX: number;
  limboZ: number;
  limboY: number;
  graveX: number;
  graveZ: number;
  graveY: number;
}

export class GameController implements IGameController {
  public sceneManager: SceneManager;
  private inputHandler: InputHandler;
  public entityManager: EntityManager;

  public state: GameState;
  public seals: SealEntity[] = [];
  public playerBattlefield: (CardEntity | null)[] = Array(GAME_CONSTANTS.SEVEN).fill(null);
  public enemyBattlefield: (CardEntity | null)[] = Array(GAME_CONSTANTS.SEVEN).fill(null);
  public playerHand: CardEntity[] = [];
  public playerDeck: CardData[] = [];
  public enemyDeck: CardData[] = [];
  public playerLimbo: CardEntity[] = [];
  public enemyLimbo: CardEntity[] = [];
  /** Cards that participated in battle this round (for Saint Michael Final Act). */
  public cardsThatBattledThisRound: CardEntity[] = [];
  public playerGraveyard: CardEntity[] = [];
  public enemyGraveyard: CardEntity[] = [];

  private playerDeckMesh!: THREE.Group;
  private enemyDeckMesh!: THREE.Group;
  public playerLimboMesh!: THREE.Group;
  public enemyLimboMesh!: THREE.Group;
  public playerGraveyardMesh!: THREE.Group;
  public enemyGraveyardMesh!: THREE.Group;
  private slotMeshes: THREE.Mesh[] = [];
  private floorMesh!: THREE.Mesh;
  private tableMesh!: THREE.Mesh;
  /** Spotlights over table (red and blue hues). */
  public spotLightRed!: THREE.SpotLight;
  public spotLightBlue!: THREE.SpotLight;
  /** Materials for deck pile layers only (card back texture when loaded). */
  private pileCardBackMaterials: THREE.MeshBasicMaterial[] = [];
  /** Meshes used for zone hover detection (Limbo/Graveyard base planes). */
  private zoneHoverMeshes: { mesh: THREE.Mesh; zone: 'playerLimbo' | 'enemyLimbo' | 'playerGraveyard' | 'enemyGraveyard' }[] = [];

  public isProcessing = false;
  private activeSelection: CardEntity | null = null;
  public currentResolvingSealIndex: number = -1;
  private selectedObject: CardEntity | null = null;
  public pendingBaronSwapSlot: number | null = null;

  public pendingAbilityData: any = null;
  public resolutionCallback: (() => void) | null = null;
  public sealSelectionCallback: ((idx: number) => void) | null = null;
  public nullifyCallback: ((confirmed: boolean) => void) | null = null;

  // Player Delta: after confirming Delta's end-of-round sacrifice, we enter targeting.
  // The selected target gets +3 markers, then we destroy the Delta source.
  public pendingDeltaSacrificeSource: CardEntity | null = null;
  public pendingDeltaSacrificeSourceIdx: number = -1;

  public uiManager: UIManager;
  public abilityManager: AbilityManager;
  public phaseManager: PhaseManager;

  /** Zone/label layout (final values from zone tuning). */
  public zoneTuningParams: ZoneTuningParams = {
    labelWidth: 3.5,
    labelHeight: 1.75,
    labelOffsetZ: 2.8,
    deckX: -15.4,
    deckZ: 6,
    deckY: 0.2,
    limboX: 15.4,
    limboZ: 6,
    limboY: 0.05,
    graveX: 19.4,
    graveZ: 6,
    graveY: 0.05
  };

  public onStateChange: (state: GameState) => void = () => {};

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.inputHandler = new InputHandler(this.sceneManager.camera, container);
    this.entityManager = new EntityManager();

    const initialState: GameState = {
      playerAlignment: Alignment.LIGHT,
      currentRound: 1,
      currentPhase: Phase.PREP,
      playerScore: 0,
      enemyScore: 0,
      playerDeckCount: 0,
      enemyDeckCount: 0,
      playerGraveyardCount: 0,
      enemyGraveyardCount: 0,
      instructionText: 'Choose your side.',
      phaseStep: '',
      powerPool: 0,
      weaknessPool: 0,
      logs: [],
      playerLimboCards: [],
      enemyLimboCards: [],
      playerGraveyardCards: [],
      enemyGraveyardCards: [],
      playerDeckCards: [],
      enemyDeckCards: []
    };

    this.uiManager = new UIManager(initialState, (s) => {
      this.state = s;
      this.onStateChange(s);
    });
    this.state = initialState;

    this.abilityManager = new AbilityManager(this);
    this.phaseManager = new PhaseManager(this);

    this.setupBoard();
    this.inputHandler.onMouseMove = this.handleMouseMove.bind(this);
    this.inputHandler.onMouseDown = this.handleMouseDown.bind(this);

    this.animate();
  }

  private setupBoard() {
    const startX = -(GAME_CONSTANTS.SEVEN - 1) * GAME_CONSTANTS.SLOT_SPACING / 2;
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      const x = startX + i * GAME_CONSTANTS.SLOT_SPACING;
      const seal = new SealEntity(x, i);
      this.seals.push(seal);
      this.entityManager.add(seal);
      this.sceneManager.scene.add(seal.mesh);
      this.sceneManager.scene.add(seal.light);
      
      // Visual slots
      this.createGridSlot(x, 3.2);
      this.createGridSlot(x, -3.2);
    }

    // Floor
    const colors = ENV_THEME_COLORS.dark;
    this.floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONSTANTS.TABLE_SIZE, GAME_CONSTANTS.TABLE_SIZE),
      new THREE.MeshPhongMaterial({ color: colors.floor, shininess: 20 })
    );
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.sceneManager.scene.add(this.floorMesh);

    // Light gray table surface for the play area (seals, deck, limbo, grave)
    const { TABLE_PLAY_WIDTH, TABLE_PLAY_DEPTH } = GAME_CONSTANTS;
    this.tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TABLE_PLAY_WIDTH, TABLE_PLAY_DEPTH),
      new THREE.MeshPhongMaterial({ color: colors.table, shininess: 30 })
    );
    this.tableMesh.rotation.x = -Math.PI / 2;
    this.tableMesh.position.y = 0.01;
    this.tableMesh.receiveShadow = true;
    this.sceneManager.scene.add(this.tableMesh);

    // Spotlights pointed down at the table (red and blue hues) – tunable via SceneTuningGui
    const spotRedTarget = new THREE.Object3D();
    spotRedTarget.position.set(0, 0, 0);
    this.sceneManager.scene.add(spotRedTarget);
    // Pulled out and more diffused: wider angle (45°), higher penumbra (0.65), farther positions
    this.spotLightRed = new THREE.SpotLight(0xcc4444, 4000, 55, Math.PI / 4, 0.65);
    this.spotLightRed.position.set(-16, 24, 0);
    this.spotLightRed.target = spotRedTarget;
    this.spotLightRed.castShadow = true;
    this.sceneManager.scene.add(this.spotLightRed);

    const spotBlueTarget = new THREE.Object3D();
    spotBlueTarget.position.set(0, 0, 0);
    this.sceneManager.scene.add(spotBlueTarget);
    this.spotLightBlue = new THREE.SpotLight(0x4444cc, 4000, 55, Math.PI / 4, 0.65);
    this.spotLightBlue.position.set(20, 24, 0);
    this.spotLightBlue.target = spotBlueTarget;
    this.spotLightBlue.castShadow = true;
    this.sceneManager.scene.add(this.spotLightBlue);

    this.setupPiles();
  }

  private setupPiles() {
    const p = this.zoneTuningParams;
    this.playerDeckMesh = this.createPile('DECK');
    this.playerDeckMesh.position.set(p.deckX, p.deckY, p.deckZ);
    this.sceneManager.scene.add(this.playerDeckMesh);

    this.enemyDeckMesh = this.createPile('DECK');
    this.enemyDeckMesh.position.set(p.deckX, p.deckY, -p.deckZ);
    this.sceneManager.scene.add(this.enemyDeckMesh);

    this.playerLimboMesh = this.createPile('LIMBO');
    this.playerLimboMesh.position.set(p.limboX, p.limboY, p.limboZ);
    this.sceneManager.scene.add(this.playerLimboMesh);
    this.registerZoneHoverMesh(this.playerLimboMesh, 'playerLimbo');

    this.enemyLimboMesh = this.createPile('LIMBO');
    this.enemyLimboMesh.position.set(p.limboX, p.limboY, -p.limboZ);
    this.sceneManager.scene.add(this.enemyLimboMesh);
    this.registerZoneHoverMesh(this.enemyLimboMesh, 'enemyLimbo');

    this.playerGraveyardMesh = this.createPile('GRAVE');
    this.playerGraveyardMesh.position.set(p.graveX, p.graveY, p.graveZ);
    this.sceneManager.scene.add(this.playerGraveyardMesh);
    this.registerZoneHoverMesh(this.playerGraveyardMesh, 'playerGraveyard');

    this.enemyGraveyardMesh = this.createPile('GRAVE');
    this.enemyGraveyardMesh.position.set(p.graveX, p.graveY, -p.graveZ);
    this.sceneManager.scene.add(this.enemyGraveyardMesh);
    this.registerZoneHoverMesh(this.enemyGraveyardMesh, 'enemyGraveyard');

    this.loadPileCardBackTexture();
  }

  /** Temporary: apply zone tuning params to existing piles (positions + label size/offset). Call after changing zoneTuningParams. */
  public applyZoneTuning(): void {
    const p = this.zoneTuningParams;
    const piles: { group: THREE.Group; zSign: number }[] = [
      { group: this.playerDeckMesh, zSign: 1 },
      { group: this.enemyDeckMesh, zSign: -1 },
      { group: this.playerLimboMesh, zSign: 1 },
      { group: this.enemyLimboMesh, zSign: -1 },
      { group: this.playerGraveyardMesh, zSign: 1 },
      { group: this.enemyGraveyardMesh, zSign: -1 }
    ];
    const posByType: Record<string, { x: number; y: number; z: number }> = {
      deck: { x: p.deckX, y: p.deckY, z: p.deckZ },
      limbo: { x: p.limboX, y: p.limboY, z: p.limboZ },
      grave: { x: p.graveX, y: p.graveY, z: p.graveZ }
    };
    const types: ('deck' | 'limbo' | 'grave')[] = ['deck', 'deck', 'limbo', 'limbo', 'grave', 'grave'];
    piles.forEach(({ group, zSign }, i) => {
      const pos = posByType[types[i]];
      group.position.set(pos.x, pos.y, zSign * pos.z);
      const label = group.getObjectByName('zoneLabel') as THREE.Mesh | undefined;
      if (label && label.geometry) {
        const oldGeo = label.geometry;
        label.geometry = new THREE.PlaneGeometry(p.labelWidth, p.labelHeight);
        oldGeo.dispose();
        label.position.z = p.labelOffsetZ;
      }
    });
  }

  private registerZoneHoverMesh(pileGroup: THREE.Group, zone: 'playerLimbo' | 'enemyLimbo' | 'playerGraveyard' | 'enemyGraveyard') {
    const base = pileGroup.children[0] as THREE.Mesh;
    if (base && base.isMesh) {
      base.userData = { zone };
      this.zoneHoverMeshes.push({ mesh: base, zone });
    }
  }

  private createPile(type: 'DECK' | 'LIMBO' | 'GRAVE'): THREE.Group {
    const colors = ENV_THEME_COLORS.dark;
    const p = this.zoneTuningParams;
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(GAME_CONSTANTS.CARD_W + 0.3, 0.1, GAME_CONSTANTS.CARD_H + 0.3),
      new THREE.MeshPhongMaterial({ color: colors.pileBase, transparent: true, opacity: colors.pileBaseOpacity })
    );
    group.add(base);

    const isDeck = type === 'DECK';
    if (isDeck) {
      for (let i = 0; i < 6; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: colors.pileDeckLayer,
          transparent: true,
          side: THREE.DoubleSide
        });
        this.pileCardBackMaterials.push(mat);
        const layer = new THREE.Mesh(
          new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W, GAME_CONSTANTS.CARD_H),
          mat
        );
        layer.rotation.x = -Math.PI / 2;
        layer.position.y = 0.05 + (i * 0.06);
        layer.rotation.z = (Math.random() - 0.5) * 0.15;
        group.add(layer);
      }
    }

    // All zone labels: same gray style and uppercase text (DECK, LIMBO, GRAVE); size/offset from zoneTuningParams
    const labelGray = 0xcccccc;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 44px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(type, 128, 48);

    const tex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(p.labelWidth, p.labelHeight),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: labelGray })
    );
    label.name = 'zoneLabel';
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.06;
    label.position.z = p.labelOffsetZ;
    group.add(label);

    return group;
  }

  private loadPileCardBackTexture(): void {
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    loader.load(cardArtUrl(CARD_BACK_PATH), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.pileCardBackMaterials.forEach((m) => {
        m.map = tex;
        m.color.setHex(0xffffff);
      });
    });
  }

  private createGridSlot(x: number, z: number) {
    const colors = ENV_THEME_COLORS.dark;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W + 0.4, GAME_CONSTANTS.CARD_H + 0.4),
      new THREE.MeshBasicMaterial({ color: colors.slotFill, transparent: true, opacity: colors.slotOpacity, side: THREE.DoubleSide })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.06, z);
    mesh.userData = { isSlot: true, slotIndex: Math.round((x - (-(GAME_CONSTANTS.SEVEN - 1) * GAME_CONSTANTS.SLOT_SPACING / 2)) / GAME_CONSTANTS.SLOT_SPACING) };
    this.sceneManager.scene.add(mesh);
    this.slotMeshes.push(mesh);
  }

  /** Switch 3D environment theme (dark/light) for accessibility. */
  public setEnvironmentTheme(theme: EnvironmentTheme) {
    const colors = ENV_THEME_COLORS[theme];
    this.sceneManager.setTheme(theme);

    (this.floorMesh.material as THREE.MeshPhongMaterial).color.setHex(colors.floor);
    (this.tableMesh.material as THREE.MeshPhongMaterial).color.setHex(colors.table);

    for (const slot of this.slotMeshes) {
      const mat = slot.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colors.slotFill);
      mat.opacity = colors.slotOpacity;
    }

    for (const seal of this.seals) {
      seal.setTheme(theme);
    }

    const pileGroups = [
      this.playerDeckMesh,
      this.enemyDeckMesh,
      this.playerLimboMesh,
      this.enemyLimboMesh,
      this.playerGraveyardMesh,
      this.enemyGraveyardMesh,
    ];
    for (const group of pileGroups) {
      const base = group.children[0] as THREE.Mesh;
      if (base?.isMesh && base.material) {
        const mat = base.material as THREE.MeshPhongMaterial;
        mat.color.setHex(colors.pileBase);
        mat.opacity = colors.pileBaseOpacity;
      }
    }

    for (const mat of this.pileCardBackMaterials) {
      mat.color.setHex(mat.map ? 0xffffff : colors.pileDeckLayer);
    }
  }

  public selectAlignment(side: Alignment) {
    this.state.playerAlignment = side;
    this.addLog(`Selected Alignment: ${side}`);
    if (side === Alignment.LIGHT) {
      this.playerDeck = this.buildDeck(LIGHT_POOL);
      this.enemyDeck = this.buildDeck(DARK_POOL);
    } else {
      this.playerDeck = this.buildDeck(DARK_POOL);
      this.enemyDeck = this.buildDeck(LIGHT_POOL);
    }
    this.updateState({ instructionText: 'Prepare for the cycle.' });
    this.phaseManager.startPrepPhase();
  }

  private buildDeck(pool: CardData[]): CardData[] {
    const tribalFactions = ['Celestial', 'Lycan', 'Daemon', 'Vampyre'];
    const specialFactions = ['Light', 'Darkness']; // God / Horseman / Avatar: 1 copy each
    let deck: CardData[] = [];
    pool.forEach(card => {
      const copies = specialFactions.includes(card.faction) ? 1 : (tribalFactions.includes(card.faction) ? 3 : 1);
      for (let i = 0; i < copies; i++) { deck.push({ ...card }); }
    });
    return deck.sort(() => Math.random() - 0.5);
  }

  public startPrep() {
    this.phaseManager.startPrepPhase();
  }


  public endPrep() {
    this.phaseManager.endPrep();
  }

  public async startResolution() {
    await this.phaseManager.startResolution();
  }

  public async resolveSeal(idx: number) {
    await this.phaseManager.resolveSeal(idx);
  }

  public isImmuneToAbilities(target: CardEntity, source: CardEntity): boolean {
    return this.abilityManager.isImmuneToAbilities(target, source);
  }

  public isProtected(card: CardEntity): boolean {
    return this.abilityManager.isProtected(card);
  }

  public async handleSiege(idx: number, attacker: CardEntity | null, isPlayer: boolean) {
    await this.phaseManager.handleSiege(idx, attacker, isPlayer);
  }

  public ascendToSeal(card: CardEntity, idx: number) {
    this.phaseManager.ascendToSeal(card, idx);
  }

  public checkGameOver() {
    this.phaseManager.checkGameOver();
  }

  public disposeCard(card: CardEntity) {
    this.sceneManager.scene.remove(card.mesh);
    this.entityManager.remove(card);
  }

  public addLog(msg: string) {
    this.uiManager.addLog(msg);
  }

  private cardToHoveredInfo(card: CardEntity): HoveredCardInfo {
    return {
      name: card.data.name,
      faction: card.data.faction,
      power: card.data.power,
      type: card.data.type,
      isChampion: card.data.isChampion,
      ability: card.data.ability,
      powerMarkers: card.data.powerMarkers,
      weaknessMarkers: card.data.weaknessMarkers,
      faceArtPath: CARD_ART_PATHS[card.data.name]
    };
  }

  private cardDataToHoveredInfo(data: CardData): HoveredCardInfo {
    return {
      name: data.name,
      faction: data.faction,
      power: data.power,
      type: data.type,
      isChampion: data.isChampion,
      ability: data.ability,
      powerMarkers: 0,
      weaknessMarkers: 0,
      faceArtPath: CARD_ART_PATHS[data.name]
    };
  }

  public updateState(patch: Partial<GameState>) {
    this.updateLimboGraveyardVisibility();
    const zonePatch: Partial<GameState> = {
      playerLimboCards: this.playerLimbo.map((c) => this.cardToHoveredInfo(c)),
      enemyLimboCards: this.enemyLimbo.map((c) => this.cardToHoveredInfo(c)),
      playerGraveyardCards: this.playerGraveyard.map((c) => this.cardToHoveredInfo(c)),
      enemyGraveyardCards: this.enemyGraveyard.map((c) => this.cardToHoveredInfo(c)),
      playerDeckCards: this.playerDeck.map((d) => this.cardDataToHoveredInfo(d)),
      enemyDeckCards: this.enemyDeck.map((d) => this.cardDataToHoveredInfo(d))
    };
    this.uiManager.updateState({ ...zonePatch, ...patch }, this.playerDeck.length, this.enemyDeck.length, this.playerGraveyard.length, this.enemyGraveyard.length);
  }

  /** Only the top card in each Limbo/Graveyard pile is visible; others are hidden. */
  private updateLimboGraveyardVisibility() {
    for (const arr of [this.playerLimbo, this.enemyLimbo, this.playerGraveyard, this.enemyGraveyard]) {
      const topIndex = arr.length - 1;
      arr.forEach((card, i) => {
        card.mesh.visible = i === topIndex;
      });
    }
  }

  /** Called from UI when user selects a card from the Limbo search modal (e.g. for Sentinel ability). */
  public selectLimboCardForAbility(zone: 'player' | 'enemy', index: number) {
    const limbo = zone === 'player' ? this.playerLimbo : this.enemyLimbo;
    const card = limbo[index];
    if (!card || this.state.currentPhase !== Phase.ABILITY_TARGETING || !this.pendingAbilityData?.effect) return;
    if (this.pendingAbilityData.effect === 'sentinel_absorb') {
      this.abilityManager.applyAbilityEffect(card, this.pendingAbilityData);
    } else if (this.pendingAbilityData.effect === 'hades_limbo_to_deck') {
      if (zone !== 'player') return;
      const idx = limbo.indexOf(card);
      if (idx !== -1) limbo.splice(idx, 1);
      const deck = this.playerDeck;
      const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, boardPresencePowerMarkers, ...baseData } = card.data;
      deck.push({ ...baseData });
      this.disposeCard(card);
      this.addLog(`Hades places ${card.data.name} from Limbo on top of deck.`);
      this.abilityManager.syncBoardPresencePowerMarkers();
    } else {
      return;
    }
    this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '', isSelectingLimboTarget: false });
    this.pendingAbilityData = null;
    if (this.resolutionCallback) this.resolutionCallback();
    this.resolutionCallback = null;
    if (this.currentResolvingSealIndex !== -1) this.zoomIn(this.currentResolvingSealIndex);
  }

  public zoomOut() {
    this.phaseManager.zoomOut();
  }

  public zoomIn(idx: number) {
    this.phaseManager.zoomIn(idx);
  }

  public async allocateCounters(card: CardEntity, isAI: boolean) {
    await this.abilityManager.allocateCounters(card, isAI);
  }

  public async handleTargetedAbility(source: CardEntity, isAI: boolean) {
    await this.abilityManager.handleTargetedAbility(source, isAI);
  }

  public async handleSealTargetAbility(source: CardEntity, isAI: boolean) {
    await this.abilityManager.handleSealTargetAbility(source, isAI);
  }

  public async executeGlobalAbility(source: CardEntity) {
    await this.abilityManager.executeGlobalAbility(source);
  }


  public finishCounters() {
    if (this.state.currentPhase !== Phase.GAME_OVER) {
      this.updateState({ powerPool: 0, weaknessPool: 0, currentPhase: Phase.RESOLUTION });
      if (this.currentResolvingSealIndex !== -1) this.zoomIn(this.currentResolvingSealIndex);
    }
    this.pendingAbilityData = null;
    // Clear any ability activation highlight on the source card, if present
    if ((this.pendingAbilityData as any)?.source) {
      (this.pendingAbilityData as any).source.data.isActivatingAbility = false;
    }
    if (this.resolutionCallback) this.resolutionCallback();
    this.resolutionCallback = null;
    this.abilityManager.syncBoardPresencePowerMarkers();
  }


  public forceSkip() {
    // Do not skip while a Fallen One nullify choice is active
    if (this.state.instructionText.includes("Use Fallen One from Limbo")) {
      this.addLog("Resolve Fallen One's nullify choice before skipping.");
      return;
    }

    this.addLog("Forcing skip of current interaction...");
    this.isProcessing = false;

    // Clear any ability activation highlight on all cards so glow never lingers after a skip
    const clearActivationGlow = (card: CardEntity | null) => {
      if (card && card.data.isActivatingAbility) {
        card.data.isActivatingAbility = false;
      }
    };
    this.playerBattlefield.forEach(clearActivationGlow);
    this.enemyBattlefield.forEach(clearActivationGlow);
    this.playerHand.forEach(clearActivationGlow);
    this.playerLimbo.forEach(clearActivationGlow);
    this.enemyLimbo.forEach(clearActivationGlow);
    this.seals.forEach(seal => clearActivationGlow(seal.champion));

    this.pendingAbilityData = null;
    
    if (this.resolutionCallback) {
      this.resolutionCallback();
      this.resolutionCallback = null;
    }
    if (this.sealSelectionCallback) {
      this.sealSelectionCallback(-1);
      this.sealSelectionCallback = null;
    }
    if (this.nullifyCallback) {
      this.nullifyCallback(false);
      this.nullifyCallback = null;
    }
    if ((this as any).creatureTypeCallback) {
      (this as any).creatureTypeCallback('');
      (this as any).creatureTypeCallback = null;
    }

    if (this.state.currentPhase !== Phase.PREP && this.state.currentPhase !== Phase.GAME_OVER) {
      this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '' });
      if (this.currentResolvingSealIndex !== -1) this.zoomIn(this.currentResolvingSealIndex);
    }

    // If Delta targeting was pending, treat skip as canceling the sacrifice.
    if (this.pendingDeltaSacrificeSource) {
      this.pendingDeltaSacrificeSource.data.pendingDeltaSacrifice = false;
      this.pendingDeltaSacrificeSource = null;
      this.pendingDeltaSacrificeSourceIdx = -1;
    }
  }

  public async handleBattle(attacker: CardEntity, defender: CardEntity, idx: number, isAgainstChamp: boolean): Promise<boolean> {
    return await this.phaseManager.handleBattle(attacker, defender, idx, isAgainstChamp);
  }

  public destroyCard(card: CardEntity, isEnemy: boolean, idx: number, isAgainstChamp: boolean = false, killedBy?: { cardName: string; cause: 'combat' | 'ability' }) {
    if (killedBy) {
      const msg = killedBy.cause === 'combat'
        ? `${card.data.name} was killed by ${killedBy.cardName} (combat damage).`
        : `${card.data.name} was destroyed by ${killedBy.cardName}'s ability.`;
      this.addLog(msg);
    }
    this.abilityManager.stripBoardPresencePowerFromCard(card);
    const limbo = isEnemy ? this.enemyLimbo : this.playerLimbo;
    const mesh = isEnemy ? this.enemyLimboMesh : this.playerLimboMesh;
    limbo.push(card);
    // Card should remain visible/interactive in Limbo/Graveyard, so do not dispose it here.
    card.data.isActivatingAbility = false;
    
    if (isAgainstChamp) {
      this.seals[idx].champion = null;
    } else {
      if (isEnemy) this.enemyBattlefield[idx] = null;
      else this.playerBattlefield[idx] = null;
    }

    // Martyr: Limbo Trigger: Purify one Neutral Seal without a Champion.
    if (card.data.name === "Martyr") {
      const target = this.seals.find(s => s.alignment === Alignment.NEUTRAL && !s.champion);
      if (target) this.claimSeal(target.index, Alignment.LIGHT, { type: 'ability', cardName: 'Martyr' });
    }

    const destX = mesh.position.x + (Math.random() - 0.5);
    const destY = 0.2 + (limbo.length * 0.05);
    const destZ = mesh.position.z + (Math.random() - 0.5);
    const destRotY = Math.random() * 0.5;

    (card as any).setOpacity(1);
    card.mesh.scale.set(1, 1, 1);

    // Explode (scale up + fade out), travel to Limbo position, then reform (scale from tiny + fade in).
    const opacityState = { value: 1 };
    const fadeTo = (value: number) => {
      opacityState.value = value;
      (card as any).setOpacity(opacityState.value);
    };
    fadeTo(1);

    this.abilityManager.syncBoardPresencePowerMarkers();

    const tl = gsap.timeline({
      onComplete: () => this.updateLimboGraveyardVisibility()
    });

    // Explode + fade out at current position
    tl.to(card.mesh.scale, { x: 1.65, y: 1.65, z: 1.65, duration: 0.18, ease: 'power2.out' }, 0);
    tl.to(opacityState, {
      value: 0,
      duration: 0.14,
      ease: 'power2.in',
      onUpdate: () => fadeTo(opacityState.value)
    }, 0);

    // Travel to Limbo while invisible
    tl.to(card.mesh.position, { x: destX, y: destY, z: destZ, duration: 0.36, ease: 'power2.inOut' }, 0.07);
    tl.to(card.mesh.rotation, { x: 0, y: destRotY, z: 0, duration: 0.36, ease: 'power2.inOut' }, 0.07);

    // Reform: tiny then scale up with a pop
    tl.add(() => {
      card.mesh.scale.set(0.01, 0.01, 0.01);
      fadeTo(0);
    }, '>');

    tl.to(card.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.32, ease: 'back.out(1.6)' }, '>');
    tl.to(opacityState, {
      value: 1,
      duration: 0.26,
      ease: 'power2.out',
      onUpdate: () => fadeTo(opacityState.value)
    }, '>');
  }

  public async claimSeal(
    idx: number,
    status: Alignment,
    cause?: { type: 'combat' | 'ability'; cardName: string }
  ): Promise<void> {
    if (this.state.lockedSealIndex === idx) {
      this.addLog(`Seal ${idx + 1} is locked and cannot be changed.`);
      return;
    }
    // Luna: Final Act: Only when Seal has no Champion; optional — you may move Luna to Graveyard to nullify.
    const sealWithoutChampion = !this.seals[idx].champion;
    const lunaCard = sealWithoutChampion
      ? [...this.playerLimbo, ...this.enemyLimbo].find(c => c.data.name === "Luna" && c.data.isEnemy !== (status === Alignment.DARK))
      : null;
    if (lunaCard) {
      const isEnemyLuna = lunaCard.data.isEnemy;
      if (isEnemyLuna) {
        if (Math.random() < 0.5) {
          this.abilityManager.moveToGraveyard(lunaCard);
          this.addLog(`Enemy uses Luna from Limbo to nullify the influence change.`);
          return;
        }
      } else {
        this.updateState({
          decisionContext: 'LUNA_NULLIFY',
          instructionText: 'Use Luna from Limbo to nullify this influence change? (Luna moves to Graveyard)',
          decisionMessage: 'Your opponent is changing a Seal\'s influence. Use Luna from your Limbo to nullify this? (Luna is moved to your Graveyard.)'
        });
        const useLuna = await new Promise<boolean>(resolve => { (this as any).nullifyCallback = resolve; });
        this.updateState({ decisionContext: undefined, decisionMessage: undefined });
        if (useLuna) {
          this.abilityManager.moveToGraveyard(lunaCard);
          this.addLog(`Luna is moved to the Graveyard to nullify the influence change.`);
          return;
        }
      }
    }

    // Prophet: Passive: Prevents Purified Seals from being Corrupted while in play.
    // Exception: Lust's explicit player choice to corrupt is allowed (Lust's "influence seal dark" option).
    if (status === Alignment.DARK) {
      const hasProphet = [...this.playerBattlefield, ...this.seals.map(s => s.champion)].some(c => c && c.data.name === "Prophet");
      const isLustChoice = cause?.cardName === 'Lust';
      if (hasProphet && this.seals[idx].alignment === Alignment.LIGHT && !isLustChoice) return;
    }

    const previousAlignment = this.seals[idx].alignment;
    const willChange = previousAlignment !== status;
    if (willChange && (status === Alignment.LIGHT || status === Alignment.DARK) && cause) {
      const verb = status === Alignment.LIGHT ? 'Purified' : 'Corrupted';
      this.addLog(`Seal ${idx + 1} ${verb} by ${cause.type} (card: ${cause.cardName}).`);
    }
    this.seals[idx].setAlignment(status);
    this.updateGlobalScores();
  }

  private updateGlobalScores() {
    const pAlign = this.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    this.state.playerScore = this.seals.filter(s => s.alignment === pAlign).length;
    this.state.enemyScore = this.seals.filter(s => s.alignment === eAlign).length;

    // Win Con: Activate with 7 Seals
    if (this.state.playerScore >= 7) {
      this.phaseManager.finalizeGame();
    } else if (this.state.enemyScore >= 7) {
      this.phaseManager.finalizeGame();
    }

    this.updateState({});
  }

  private handleMouseMove(event: MouseEvent) {
    // When a decision or targeting prompt is active, still allow card hover preview but don't overwrite instruction text
    const promptActive = !!this.state.decisionContext ||
      this.state.currentPhase === Phase.ABILITY_TARGETING ||
      this.state.currentPhase === Phase.SEAL_TARGETING ||
      this.state.currentPhase === Phase.COUNTER_ALLOCATION ||
      this.state.currentPhase === Phase.DELTA_BUFF_TARGETING;

    const sealChampions = this.seals.map(s => s.champion).filter((c): c is CardEntity => c !== null);
    const allCards = [...this.playerHand, ...this.playerBattlefield, ...this.enemyBattlefield, ...this.playerLimbo, ...this.enemyLimbo, ...sealChampions].filter(c => c !== null) as CardEntity[];
    const intersects = this.inputHandler.raycaster.intersectObjects(allCards.map(c => c.mesh), true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
      const card = allCards.find(c => c.mesh === obj);
      if (card && this.selectedObject !== card) {
        this.selectedObject = card;
        const hovered: HoveredCardInfo = {
          name: card.data.name,
          faction: card.data.faction,
          power: card.data.power,
          type: card.data.type,
          isChampion: card.data.isChampion,
          ability: card.data.ability,
          powerMarkers: card.data.powerMarkers,
          weaknessMarkers: card.data.weaknessMarkers,
          faceArtPath: CARD_ART_PATHS[card.data.name]
        };
        if (promptActive) {
          this.updateState({ hoveredCard: hovered, hoveredZone: null });
        } else {
          this.updateState({ instructionText: `${card.data.name}: ${card.data.ability}`, hoveredCard: hovered, hoveredZone: null });
        }
      }
    } else {
      const zoneMeshes = this.zoneHoverMeshes.map((z) => z.mesh);
      const zoneIntersects = this.inputHandler.raycaster.intersectObjects(zoneMeshes);
      let hoveredZone: GameState['hoveredZone'] = null;
      if (zoneIntersects.length > 0) {
        const hitMesh = zoneIntersects[0].object as THREE.Mesh;
        const entry = this.zoneHoverMeshes.find((z) => z.mesh === hitMesh);
        if (entry) {
          hoveredZone = { zone: entry.zone, count: this.getZoneCount(entry.zone) };
        }
      }
      this.selectedObject = null;
      this.updateState({ hoveredCard: null, hoveredZone });
    }
  }

  private getZoneCount(zone: 'playerLimbo' | 'enemyLimbo' | 'playerGraveyard' | 'enemyGraveyard'): number {
    switch (zone) {
      case 'playerLimbo': return this.playerLimbo.length;
      case 'enemyLimbo': return this.enemyLimbo.length;
      case 'playerGraveyard': return this.playerGraveyard.length;
      case 'enemyGraveyard': return this.enemyGraveyard.length;
    }
  }

  private async handleMouseDown(event: MouseEvent) {
    if (this.state.currentPhase === Phase.PREP) {
      const limboIntersects = this.inputHandler.raycaster.intersectObjects(this.playerLimbo.map(c => c.mesh), true);
      if (limboIntersects.length > 0) {
        let obj = limboIntersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = this.playerLimbo.find(c => c.mesh === obj);
        if (card && this.pendingBaronSwapSlot !== null) {
          const slot = this.pendingBaronSwapSlot;
          const baron = this.playerBattlefield[slot];
          if (baron?.data.hasSwapAbility) {
            this.playerBattlefield[slot] = null;
            this.playerLimbo = this.playerLimbo.filter(c => c !== card);
            this.playerLimbo.push(baron);
            this.playerBattlefield[slot] = card;
            gsap.to(baron.mesh.position, { x: 15, y: 0.2 + (this.playerLimbo.length * 0.05), z: 6, duration: 0.4 });
            gsap.to(baron.mesh.rotation, { x: Math.PI, y: 0, z: 0, duration: 0.4 });
            gsap.to(card.mesh.position, { x: (slot - 3) * GAME_CONSTANTS.SLOT_SPACING, y: 0.1, z: 3.2, duration: 0.4 });
            gsap.to(card.mesh.rotation, { x: Math.PI, y: 0, z: 0, duration: 0.4 });
            card.applyBackTextureIfNeeded();
            this.addLog(`Baron swaps with ${card.data.name} in Limbo.`);
            this.pendingBaronSwapSlot = null;
            this.updateState({ instructionText: '' });
            this.abilityManager.syncBoardPresencePowerMarkers();
          }
          return;
        }
        if (card && card.data.hasLimboAbility) {
          this.abilityManager.handleLimboAbility(card);
          return;
        }
      }
      const playerBfCards = this.playerBattlefield.filter(c => c !== null) as CardEntity[];
      const bfIntersects = this.inputHandler.raycaster.intersectObjects(playerBfCards.map(c => c.mesh), true);
      if (bfIntersects.length > 0 && this.pendingBaronSwapSlot === null) {
        let obj = bfIntersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = playerBfCards.find(c => c.mesh === obj);
        if (card?.data.hasSwapAbility) {
          const slot = this.playerBattlefield.indexOf(card);
          this.pendingBaronSwapSlot = slot;
          this.updateState({ instructionText: "Baron: Select a creature in your Limbo to swap with Baron." });
          return;
        }
      }

      const handIntersects = this.inputHandler.raycaster.intersectObjects(this.playerHand.map(c => c.mesh), true);
      if (handIntersects.length > 0) {
        let obj = handIntersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        this.activeSelection = this.playerHand.find(c => c.mesh === obj) || null;
        return;
      }

      if (this.activeSelection) {
        const slotIntersects = this.inputHandler.raycaster.intersectObjects(this.slotMeshes);
        const playerSlotIntersect = slotIntersects.find(i => i.object.position.z > 0.5);
        
        if (playerSlotIntersect) {
          const idx = playerSlotIntersect.object.userData.slotIndex;
          if (idx >= 0 && idx < GAME_CONSTANTS.SEVEN && !this.playerBattlefield[idx]) {
            const card = this.activeSelection;
            this.addLog(`Player places ${card.data.name} at Seal ${idx + 1}`);
            this.playerHand = this.playerHand.filter(c => c !== card);
            this.playerBattlefield[idx] = card;
            gsap.to(card.mesh.position, {
              x: (idx - 3) * GAME_CONSTANTS.SLOT_SPACING,
              y: 0.1,
              z: 3.2,
              duration: 0.5
            });
            gsap.to(card.mesh.rotation, { x: Math.PI, y: 0, z: 0, duration: 0.5 });
            card.applyBackTextureIfNeeded();
            this.activeSelection = null;
            this.abilityManager.syncBoardPresencePowerMarkers();
          }
        }
      }
    } else if (this.state.currentPhase === Phase.COUNTER_ALLOCATION) {
      const allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null && c.data.faceUp) as CardEntity[];
      const intersects = this.inputHandler.raycaster.intersectObjects(allBoard.map(c => c.mesh), true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = allBoard.find(c => c.mesh === obj);
        if (card) {
          if (this.pendingAbilityData && this.pendingAbilityData.source && this.isImmuneToAbilities(card, this.pendingAbilityData.source)) {
            this.addLog(`${card.data.name} is immune to markers from ${this.pendingAbilityData.source.data.name}`);
            return;
          }
          if (this.state.powerPool > 0) {
            card.data.powerMarkers++;
            this.updateState({ powerPool: this.state.powerPool - 1 });
          } else if (this.state.weaknessPool > 0) {
            card.data.weaknessMarkers++;
            this.updateState({ weaknessPool: this.state.weaknessPool - 1 });
          }
          card.updateVisualMarkers();
        }
      }
    } else if (this.state.currentPhase === Phase.DELTA_BUFF_TARGETING) {
      const allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null && c.data.faceUp) as CardEntity[];
      const intersects = this.inputHandler.raycaster.intersectObjects(allBoard.map(c => c.mesh), true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = allBoard.find(c => c.mesh === obj);
        if (card) {
          card.data.powerMarkers += 3;
          card.updateVisualMarkers();
          this.addLog(`${card.data.name} receives +3 Power Markers from Delta's sacrifice.`);

          // Execute the sacrifice after the player picks the +3 recipient.
          const deltaSource = this.pendingDeltaSacrificeSource;
          const deltaIdx = this.pendingDeltaSacrificeSourceIdx;
          this.pendingDeltaSacrificeSource = null;
          this.pendingDeltaSacrificeSourceIdx = -1;
          if (deltaSource) {
            deltaSource.data.pendingDeltaSacrifice = false;
            const isEnemy = deltaSource.data.isEnemy;
            const actualIdx = deltaIdx >= 0
              ? deltaIdx
              : isEnemy
                ? this.enemyBattlefield.indexOf(deltaSource)
                : this.playerBattlefield.indexOf(deltaSource);
            if (actualIdx >= 0) {
              this.destroyCard(deltaSource, isEnemy, actualIdx, false);
            }
          }

          this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '' });
          if (this.resolutionCallback) this.resolutionCallback();
          this.resolutionCallback = null;
        }
      }
    } else if (this.state.currentPhase === Phase.ABILITY_TARGETING) {
      const forSentinel = this.pendingAbilityData?.effect === 'sentinel_absorb';
      const forSaintMichael = this.pendingAbilityData?.effect === 'saint_michael_destroy';
      const forChampion = this.pendingAbilityData?.targetType === 'champion';
      let allBoard: CardEntity[];
      if (this.pendingAbilityData?.validTargets?.length) {
        allBoard = this.pendingAbilityData.validTargets as CardEntity[];
      } else if (forSentinel) {
        allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion), ...this.playerLimbo, ...this.enemyLimbo].filter(c => c !== null) as CardEntity[];
      } else if (forChampion) {
        allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null && c.data.faceUp && c.data.isChampion) as CardEntity[];
      } else {
        allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null && c.data.faceUp) as CardEntity[];
        // Include cards at the current seal that were just revealed (not yet faceUp) so they can be targeted (e.g. Famine destroying Herald)
        if (this.currentResolvingSealIndex >= 0 && this.currentResolvingSealIndex < this.playerBattlefield.length) {
          const p = this.playerBattlefield[this.currentResolvingSealIndex];
          const e = this.enemyBattlefield[this.currentResolvingSealIndex];
          if (p && !allBoard.includes(p)) allBoard = [...allBoard, p];
          if (e && !allBoard.includes(e)) allBoard = [...allBoard, e];
        }
      }
      const intersects = this.inputHandler.raycaster.intersectObjects(allBoard.map(c => c.mesh), true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = allBoard.find(c => c.mesh === obj);
        if (card) {
          if (forSentinel && !this.playerLimbo.includes(card) && !this.enemyLimbo.includes(card)) return; // Sentinel must target Limbo
          if (forChampion && !card.data.isChampion) return; // Lord must target Champion
          this.abilityManager.applyAbilityEffect(card, this.pendingAbilityData);
          const phaseAfterEffect = this.state.currentPhase as Phase;
          if (phaseAfterEffect !== Phase.GAME_OVER) {
            this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '', isSelectingLimboTarget: false });
            if (this.currentResolvingSealIndex !== -1) this.zoomIn(this.currentResolvingSealIndex);
          }
          this.pendingAbilityData = null;
          if (this.resolutionCallback) this.resolutionCallback();
          this.resolutionCallback = null;
        }
      }
    } else if (this.state.currentPhase === Phase.SEAL_TARGETING) {
      const sealMeshes = this.seals.map(s => s.mesh);
      const intersects = this.inputHandler.raycaster.intersectObjects(sealMeshes);
      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const seal = this.seals.find(s => s.mesh === mesh);
        if (seal) {
          if (this.sealSelectionCallback) {
            this.sealSelectionCallback(seal.index);
            this.sealSelectionCallback = null;
            this.updateState({ currentPhase: Phase.RESOLUTION });
            return;
          }
          if (!seal.champion) {
            if (this.pendingAbilityData.corruptOnly && seal.alignment !== Alignment.DARK) {
              this.addLog("The Almighty can only Purify a Corrupted (Dark) Seal.");
              return;
            }
            await this.claimSeal(seal.index, this.pendingAbilityData.effect, {
              type: 'ability',
              cardName: this.pendingAbilityData.source.data.name
            });
            const phaseAfterClaim = this.state.currentPhase as Phase;
            if (phaseAfterClaim !== Phase.GAME_OVER) {
              this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '' });
              if (this.currentResolvingSealIndex !== -1) this.zoomIn(this.currentResolvingSealIndex);
            }
            if (this.resolutionCallback) this.resolutionCallback();
            this.resolutionCallback = null;
          }
        }
      }
    }
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this));
    const time = Date.now() * 0.001;
    this.entityManager.update(time);
    this.sceneManager.update();
  }

  public dispose() {
    this.sceneManager.dispose();
    this.inputHandler.dispose();
    this.entityManager.clear();
  }
}
