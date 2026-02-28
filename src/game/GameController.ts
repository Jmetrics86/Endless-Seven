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
import { Alignment, Phase, CardData, GameState } from '../types';
import { LIGHT_POOL, DARK_POOL, GAME_CONSTANTS } from '../constants';
import { UIManager } from './UIManager';
import { AbilityManager } from './AbilityManager';
import { PhaseManager } from './PhaseManager';
import { IGameController } from './interfaces';

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
  public playerGraveyard: CardEntity[] = [];
  public enemyGraveyard: CardEntity[] = [];

  private playerDeckMesh!: THREE.Group;
  private enemyDeckMesh!: THREE.Group;
  public playerLimboMesh!: THREE.Group;
  public enemyLimboMesh!: THREE.Group;
  public playerGraveyardMesh!: THREE.Group;
  public enemyGraveyardMesh!: THREE.Group;
  private slotMeshes: THREE.Mesh[] = [];

  public isProcessing = false;
  private activeSelection: CardEntity | null = null;
  public currentResolvingSealIndex: number = -1;
  private selectedObject: CardEntity | null = null;

  public pendingAbilityData: any = null;
  public resolutionCallback: (() => void) | null = null;
  public sealSelectionCallback: ((idx: number) => void) | null = null;
  public nullifyCallback: ((confirmed: boolean) => void) | null = null;

  public uiManager: UIManager;
  public abilityManager: AbilityManager;
  public phaseManager: PhaseManager;

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
      logs: []
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
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONSTANTS.TABLE_SIZE, GAME_CONSTANTS.TABLE_SIZE),
      new THREE.MeshPhongMaterial({ color: 0x08080c, shininess: 20 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.sceneManager.scene.add(floor);

    this.setupPiles();
  }

  private setupPiles() {
    const startX = -(GAME_CONSTANTS.SEVEN - 1) * GAME_CONSTANTS.SLOT_SPACING / 2;
    const deckOffset = startX - 4;
    const limboOffset = (startX + (GAME_CONSTANTS.SEVEN - 1) * GAME_CONSTANTS.SLOT_SPACING) + 4;

    this.playerDeckMesh = this.createPile(0x0077aa, "DECK", 0x00f2ff);
    this.playerDeckMesh.position.set(deckOffset, 0.2, 6);
    this.sceneManager.scene.add(this.playerDeckMesh);

    this.enemyDeckMesh = this.createPile(0xaa2233, "DECK", 0xff0044);
    this.enemyDeckMesh.position.set(deckOffset, 0.2, -6);
    this.sceneManager.scene.add(this.enemyDeckMesh);

    this.playerLimboMesh = this.createPile(0x444444, "LIMBO", 0xcccccc);
    this.playerLimboMesh.position.set(limboOffset, 0.05, 6);
    this.sceneManager.scene.add(this.playerLimboMesh);

    this.enemyLimboMesh = this.createPile(0x444444, "LIMBO", 0xcccccc);
    this.enemyLimboMesh.position.set(limboOffset, 0.05, -6);
    this.sceneManager.scene.add(this.enemyLimboMesh);

    const graveyardOffset = limboOffset + 4;
    this.playerGraveyardMesh = this.createPile(0x222222, "GRAVE", 0x888888);
    this.playerGraveyardMesh.position.set(graveyardOffset, 0.05, 6);
    this.sceneManager.scene.add(this.playerGraveyardMesh);

    this.enemyGraveyardMesh = this.createPile(0x222222, "GRAVE", 0x888888);
    this.enemyGraveyardMesh.position.set(graveyardOffset, 0.05, -6);
    this.sceneManager.scene.add(this.enemyGraveyardMesh);
  }

  private createPile(color: number, text: string, labelColor: number): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(GAME_CONSTANTS.CARD_W + 0.3, 0.1, GAME_CONSTANTS.CARD_H + 0.3),
      new THREE.MeshPhongMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })
    );
    group.add(base);

    for (let i = 0; i < 6; i++) {
      const layer = new THREE.Mesh(
        new THREE.BoxGeometry(GAME_CONSTANTS.CARD_W, 0.05, GAME_CONSTANTS.CARD_H),
        new THREE.MeshPhongMaterial({ color })
      );
      layer.position.y = 0.05 + (i * 0.06);
      layer.rotation.y = (Math.random() - 0.5) * 0.15;
      group.add(layer);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 44px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 48);
    
    const tex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 1.75),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: labelColor })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.8;
    group.add(label);

    return group;
  }

  private createGridSlot(x: number, z: number) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W + 0.4, GAME_CONSTANTS.CARD_H + 0.4),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.06, z);
    mesh.userData = { isSlot: true, slotIndex: Math.round((x - (-(GAME_CONSTANTS.SEVEN - 1) * GAME_CONSTANTS.SLOT_SPACING / 2)) / GAME_CONSTANTS.SLOT_SPACING) };
    this.sceneManager.scene.add(mesh);
    this.slotMeshes.push(mesh);
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
    let deck: CardData[] = [];
    pool.forEach(card => {
      let copies = (card.type === 'Avatar' || card.type === 'God') ? 1 : 3;
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

  public updateState(patch: Partial<GameState>) {
    this.uiManager.updateState(patch, this.playerDeck.length, this.enemyDeck.length, this.playerGraveyard.length, this.enemyGraveyard.length);
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
    if (this.resolutionCallback) this.resolutionCallback();
    this.resolutionCallback = null;
  }


  public forceSkip() {
    // Do not skip while a Fallen One nullify choice is active
    if (this.state.instructionText.includes("Use Fallen One from Limbo")) {
      this.addLog("Resolve Fallen One's nullify choice before skipping.");
      return;
    }

    this.addLog("Forcing skip of current interaction...");
    this.isProcessing = false;
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

    if (this.state.currentPhase !== Phase.PREP && this.state.currentPhase !== Phase.GAME_OVER) {
      this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '' });
      if (this.currentResolvingSealIndex !== -1) this.zoomIn(this.currentResolvingSealIndex);
    }
  }

  public async handleBattle(attacker: CardEntity, defender: CardEntity, idx: number, isAgainstChamp: boolean): Promise<boolean> {
    return await this.phaseManager.handleBattle(attacker, defender, idx, isAgainstChamp);
  }

  public destroyCard(card: CardEntity, isEnemy: boolean, idx: number, isAgainstChamp: boolean = false) {
    const limbo = isEnemy ? this.enemyLimbo : this.playerLimbo;
    const mesh = isEnemy ? this.enemyLimboMesh : this.playerLimboMesh;
    limbo.push(card);
    this.entityManager.remove(card);
    
    if (isAgainstChamp) {
      this.seals[idx].champion = null;
    } else {
      if (isEnemy) this.enemyBattlefield[idx] = null;
      else this.playerBattlefield[idx] = null;
    }

    // Martyr: Limbo Trigger: Purify one Neutral Seal without a Champion.
    if (card.data.name === "Martyr") {
      const target = this.seals.find(s => s.alignment === Alignment.NEUTRAL && !s.champion);
      if (target) this.claimSeal(target.index, Alignment.LIGHT);
    }

    gsap.to(card.mesh.position, {
      x: mesh.position.x + (Math.random() - 0.5),
      y: 0.2 + (limbo.length * 0.05),
      z: mesh.position.z + (Math.random() - 0.5),
      duration: 0.8
    });
    gsap.to(card.mesh.rotation, { x: 0, y: Math.random() * 0.5, z: 0, duration: 0.8 });
  }

  public async claimSeal(idx: number, status: Alignment): Promise<void> {
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
        this.updateState({ decisionContext: 'LUNA_NULLIFY', instructionText: 'Use Luna from Limbo to nullify this influence change? (Luna moves to Graveyard)' });
        const useLuna = await new Promise<boolean>(resolve => { (this as any).nullifyCallback = resolve; });
        this.updateState({ decisionContext: undefined });
        if (useLuna) {
          this.abilityManager.moveToGraveyard(lunaCard);
          this.addLog(`Luna is moved to the Graveyard to nullify the influence change.`);
          return;
        }
      }
    }

    // Prophet: Passive: Prevents Purified Seals from being Corrupted while in play.
    if (status === Alignment.DARK) {
      const hasProphet = [...this.playerBattlefield, ...this.seals.map(s => s.champion)].some(c => c && c.data.name === "Prophet");
      if (hasProphet && this.seals[idx].alignment === Alignment.LIGHT) return;
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
    const allCards = [...this.playerHand, ...this.playerBattlefield, ...this.enemyBattlefield, ...this.playerLimbo, ...this.enemyLimbo].filter(c => c !== null) as CardEntity[];
    const intersects = this.inputHandler.raycaster.intersectObjects(allCards.map(c => c.mesh), true);
    
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
      const card = allCards.find(c => c.mesh === obj);
      if (card && this.selectedObject !== card) {
        this.selectedObject = card;
        this.updateState({ instructionText: `${card.data.name}: ${card.data.ability}` });
      }
    } else {
      this.selectedObject = null;
    }
  }

  private async handleMouseDown(event: MouseEvent) {
    if (this.state.currentPhase === Phase.PREP) {
      const limboIntersects = this.inputHandler.raycaster.intersectObjects(this.playerLimbo.map(c => c.mesh), true);
      if (limboIntersects.length > 0) {
        let obj = limboIntersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = this.playerLimbo.find(c => c.mesh === obj);
        if (card && card.data.hasLimboAbility) {
          this.abilityManager.handleLimboAbility(card);
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
            this.activeSelection = null;
          }
        }
      }
    } else if (this.state.currentPhase === Phase.COUNTER_ALLOCATION) {
      const allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[];
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
      const allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[];
      const intersects = this.inputHandler.raycaster.intersectObjects(allBoard.map(c => c.mesh), true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = allBoard.find(c => c.mesh === obj);
        if (card) {
          card.data.powerMarkers += 3;
          card.updateVisualMarkers();
          this.addLog(`${card.data.name} receives +3 Power Markers from Delta's sacrifice.`);
          this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '' });
          if (this.resolutionCallback) this.resolutionCallback();
          this.resolutionCallback = null;
        }
      }
    } else if (this.state.currentPhase === Phase.ABILITY_TARGETING) {
      const forSentinel = this.pendingAbilityData?.effect === 'sentinel_absorb';
      const allBoard = forSentinel
        ? ([...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion), ...this.playerLimbo, ...this.enemyLimbo].filter(c => c !== null) as CardEntity[])
        : ([...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[]);
      const intersects = this.inputHandler.raycaster.intersectObjects(allBoard.map(c => c.mesh), true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = allBoard.find(c => c.mesh === obj);
        if (card) {
          if (forSentinel && !this.playerLimbo.includes(card) && !this.enemyLimbo.includes(card)) return; // Sentinel must target Limbo
          this.abilityManager.applyAbilityEffect(card, this.pendingAbilityData);
          const phaseAfterEffect = this.state.currentPhase as Phase;
          if (phaseAfterEffect !== Phase.GAME_OVER) {
            this.updateState({ currentPhase: Phase.RESOLUTION, instructionText: '' });
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
            await this.claimSeal(seal.index, this.pendingAbilityData.effect);
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
