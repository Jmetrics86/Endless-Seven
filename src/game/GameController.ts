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

export class GameController {
  private sceneManager: SceneManager;
  private inputHandler: InputHandler;
  private entityManager: EntityManager;

  public state: GameState;
  private seals: SealEntity[] = [];
  private playerBattlefield: (CardEntity | null)[] = Array(GAME_CONSTANTS.SEVEN).fill(null);
  private enemyBattlefield: (CardEntity | null)[] = Array(GAME_CONSTANTS.SEVEN).fill(null);
  private playerHand: CardEntity[] = [];
  private playerDeck: CardData[] = [];
  private enemyDeck: CardData[] = [];
  private playerLimbo: CardEntity[] = [];
  private enemyLimbo: CardEntity[] = [];

  private playerDeckMesh!: THREE.Group;
  private enemyDeckMesh!: THREE.Group;
  private playerLimboMesh!: THREE.Group;
  private enemyLimboMesh!: THREE.Group;
  private slotMeshes: THREE.Mesh[] = [];

  private isProcessing = false;
  private activeSelection: CardEntity | null = null;
  private currentResolvingSealIndex: number = -1;
  private selectedObject: CardEntity | null = null;

  private pendingAbilityData: any = null;
  private resolutionCallback: (() => void) | null = null;

  public onStateChange: (state: GameState) => void = () => {};

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.inputHandler = new InputHandler(this.sceneManager.camera, container);
    this.entityManager = new EntityManager();

    this.state = {
      playerAlignment: Alignment.LIGHT,
      currentRound: 1,
      currentPhase: Phase.PREP,
      playerScore: 0,
      enemyScore: 0,
      playerDeckCount: 0,
      enemyDeckCount: 0,
      instructionText: 'Choose your side.',
      phaseStep: '',
      powerPool: 0,
      weaknessPool: 0,
      logs: []
    };

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
    this.startPrepPhase();
  }

  private buildDeck(pool: CardData[]): CardData[] {
    let deck: CardData[] = [];
    pool.forEach(card => {
      let copies = (card.type === 'Avatar' || card.type === 'God') ? 1 : 3;
      for (let i = 0; i < copies; i++) { deck.push({ ...card }); }
    });
    return deck.sort(() => Math.random() - 0.5);
  }

  private async startPrepPhase() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.addLog(`--- Round ${this.state.currentRound} Prep Phase ---`);
    this.updateState({ currentPhase: Phase.PREP, phaseStep: 'Step 1: Draw Hand' });

    // Clear temporary invincibility from previous rounds
    [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)]
      .filter(c => c !== null)
      .forEach(c => {
        if (c!.data.isInvincible) {
          c!.data.isInvincible = false;
          this.addLog(`${c!.data.name}'s Invulnerability fades.`);
        }
      });

    for (let i = 0; i < 8; i++) {
      if (this.playerDeck.length === 0) break;
      const cardData = this.playerDeck.pop()!;
      const card = new CardEntity(cardData, false, this.state.playerAlignment);
      this.entityManager.add(card);
      card.mesh.position.set(-15, 2, 6); // Deck position
      this.sceneManager.scene.add(card.mesh);
      this.playerHand.push(card);

      const offset = (i - 3.5);
      gsap.to(card.mesh.position, {
        x: offset * 2.15,
        y: 12,
        z: 21 + (Math.abs(offset) * 0.3),
        duration: 0.6,
        ease: "power2.out"
      });
      gsap.to(card.mesh.rotation, { x: 0.85, y: offset * 0.06, duration: 0.6 });
      await new Promise(r => setTimeout(r, 100));
    }

    this.enemyReinforce();
    this.isProcessing = false;
    this.updateState({ phaseStep: 'Step 3: Reinforce' });
  }

  private enemyReinforce() {
    const aiHand: CardData[] = [];
    for (let i = 0; i < 8; i++) { if (this.enemyDeck.length > 0) aiHand.push(this.enemyDeck.pop()!); }
    
    const vacantSlots = this.enemyBattlefield.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
    for (let i = 0; i < vacantSlots.length && aiHand.length > 0; i++) {
      const slotIdx = vacantSlots[i];
      const cardData = aiHand.shift()!;
      const card = new CardEntity(cardData, true, this.state.playerAlignment);
      this.entityManager.add(card);
      card.mesh.position.set(-15, 2, -6);
      card.mesh.rotation.x = Math.PI;
      this.sceneManager.scene.add(card.mesh);
      this.enemyBattlefield[slotIdx] = card;

      gsap.to(card.mesh.position, {
        x: (slotIdx - 3) * GAME_CONSTANTS.SLOT_SPACING,
        y: 0.1,
        z: -3.2,
        duration: 0.8,
        delay: i * 0.15
      });
    }
    this.updateState({});
  }

  public endPrep() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.addLog("Ending Prep Phase. Purging hand...");
    this.updateState({ phaseStep: 'Purging hand...' });

    this.playerHand.forEach((card, i) => {
      this.playerLimbo.push(card);
      gsap.to(card.mesh.position, {
        x: 15,
        y: 0.2 + (this.playerLimbo.length * 0.05),
        z: 6,
        duration: 0.6,
        delay: i * 0.05,
        onComplete: () => {
          card.mesh.rotation.set(0, 0, 0);
          card.updateVisualMarkers();
        }
      });
    });
    this.playerHand = [];
    setTimeout(() => this.startResolution(), 800);
  }

  private async startResolution() {
    this.updateState({ currentPhase: Phase.RESOLUTION });
    this.addLog("--- Resolution Phase Started ---");
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      if (this.state.currentPhase === Phase.GAME_OVER) break;
      await this.resolveSeal(i);
    }
    
    if (this.state.currentPhase !== Phase.GAME_OVER) {
      // Reset camera
      gsap.to(this.sceneManager.camera.position, { x: 0, y: 28, z: 32, duration: 1.5, ease: "power2.inOut" });
      gsap.to(this.sceneManager.cameraTarget, { x: 0, y: 0, z: -2, duration: 1.5, ease: "power2.inOut" });
      await new Promise(r => setTimeout(r, 1600));

      if (this.state.currentRound >= 3) {
        this.finalizeGame();
      } else {
        this.state.currentRound++;
        this.isProcessing = false;
        this.startPrepPhase();
      }
    }
  }

  private async resolveSeal(idx: number) {
    this.currentResolvingSealIndex = idx;
    const seal = this.seals[idx];
    this.updateState({ phaseStep: `Resolving Seal ${idx + 1}` });
    this.addLog(`Resolving Seal ${idx + 1}...`);
    
    this.zoomIn(idx);
    await new Promise(r => setTimeout(r, 1000));

    let pCard = this.playerBattlefield[idx];
    let eCard = this.enemyBattlefield[idx];

    // Step 0: Haste Check
    const pHaste = pCard && pCard.data.ability.toLowerCase().includes("haste");
    const eHaste = eCard && eCard.data.ability.toLowerCase().includes("haste");

    if (pHaste || eHaste) {
      this.updateState({ phaseStep: "Step 0: Haste Strike" });
      if (pCard && eCard) await this.handleBattle(pCard, eCard, idx, false);
      else if (pCard && seal.champion && seal.champion.data.isEnemy) await this.handleBattle(pCard, seal.champion, idx, true);
      else if (eCard && seal.champion && !seal.champion.data.isEnemy) await this.handleBattle(eCard, seal.champion, idx, true);
      
      pCard = this.playerBattlefield[idx];
      eCard = this.enemyBattlefield[idx];
    }

    // Step A: The Flip
    this.updateState({ phaseStep: "Step A: The Flip" });
    const pFlipping = pCard && !pCard.data.faceUp;
    const eFlipping = eCard && !eCard.data.faceUp;
    if (pFlipping) {
      gsap.to(pCard.mesh.rotation, { x: 0, duration: 0.5 });
      this.addLog(`Player reveals ${pCard.data.name}`);
    }
    if (eFlipping) {
      gsap.to(eCard.mesh.rotation, { x: 0, duration: 0.5 });
      this.addLog(`Enemy reveals ${eCard.data.name}`);
    }
    if (pFlipping || eFlipping) await new Promise(r => setTimeout(r, 800));

    // Step B: Flip & Activate Abilities
    this.updateState({ phaseStep: "Step B: Abilities" });
    this.addLog("Processing Abilities...");
    let pEff = pCard ? pCard.data.power + pCard.data.powerMarkers - pCard.data.weaknessMarkers : 999;
    let eEff = eCard ? eCard.data.power + eCard.data.powerMarkers - eCard.data.weaknessMarkers : 999;
    
    let executionOrder: ('player' | 'enemy' | 'champion')[] = [];
    if (pEff < eEff) executionOrder = ['player', 'enemy'];
    else if (eEff < pEff) executionOrder = ['enemy', 'player'];
    else executionOrder = Math.random() < 0.5 ? ['player', 'enemy'] : ['enemy', 'player'];

    if (seal.champion) executionOrder.push('champion');

    for (const side of executionOrder) {
      let current: CardEntity | null = null;
      let opponent: CardEntity | null = null;
      let isFlipping = false;

      if (side === 'player') {
        current = pCard;
        opponent = eCard;
        isFlipping = pFlipping;
      } else if (side === 'enemy') {
        current = eCard;
        opponent = pCard;
        isFlipping = eFlipping;
      } else {
        current = seal.champion;
        opponent = current?.data.isEnemy ? pCard : eCard;
        isFlipping = false; // Champions are already face up
      }

      if (!current || current.data.isSuppressed) continue;
      
      const isActivate = current.data.ability.includes("Activate");
      if (!isFlipping && !isActivate) continue;

      if (current.data.hasNullify) {
        if (opponent && !opponent.data.faceUp && !this.isImmuneToAbilities(opponent, current)) {
          opponent.data.faceUp = true;
          opponent.data.isSuppressed = true;
          opponent.updateVisualMarkers();
          this.addLog(`${current.data.name} reveals and nullifies ${opponent.data.name}`);
          gsap.to(opponent.mesh.rotation, { x: 0, duration: 0.5 });
        } else if (opponent && opponent.data.faceUp) {
          this.addLog(`${current.data.name}'s nullify fails: ${opponent.data.name} is already revealed.`);
        } else if (opponent) {
          this.addLog(`${opponent.data.name} is immune to ${current.data.name}'s nullify`);
        }
      }
      if (current.data.ability.toLowerCase().includes("invulnerability")) {
        current.data.isInvincible = true;
        this.addLog(`${current.data.name} gains Invulnerability`);
      }
      if (current.data.name === "The Spinner" || current.data.name === "Omega" || current.data.name === "Lord") {
        const count = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)]
          .filter(c => c !== null && c.data.faction === current!.data.faction).length;
        current.data.powerMarkers += count;
        current.updateVisualMarkers();
        this.addLog(`${current.data.name} gains ${count} Power Markers from faction presence`);
      }
      if (current.data.name === "Herald") {
        const deck = side === 'player' ? this.playerDeck : this.enemyDeck;
        if (deck.length > 0) {
          const topCard = deck[deck.length - 1];
          const markers = topCard.power;
          current.data.powerMarkers += markers;
          current.updateVisualMarkers();
          this.addLog(`${current.data.name} gains ${markers} Power Markers from top of deck (${topCard.name})`);
        } else {
          this.addLog(`${current.data.name} finds no cards in deck to gain markers from`);
        }
      }
      if (current.data.name === "Beta") {
        const neighbors = [];
        if (idx > 0) neighbors.push(side === 'player' ? this.playerBattlefield[idx-1] : this.enemyBattlefield[idx-1]);
        if (idx < 6) neighbors.push(side === 'player' ? this.playerBattlefield[idx+1] : this.enemyBattlefield[idx+1]);
        neighbors.forEach(n => {
          if (n) {
            n.data.powerMarkers += 2;
            n.updateVisualMarkers();
          }
        });
        current.data.isInvincible = true;
        this.addLog(`${current.data.name} buffs neighbors and gains Invulnerability`);
      }
      if (current.data.name === "Lust") {
        if (opponent && !this.isImmuneToAbilities(opponent, current)) {
          this.addLog(`${current.data.name} forces mutual sacrifice with ${opponent.data.name}`);
          this.destroyCard(current, side === 'enemy', idx, false);
          this.destroyCard(opponent, side === 'player' ? false : true, idx, false);
        } else if (opponent) {
          this.addLog(`${opponent.data.name} is immune to ${current.data.name}'s sacrifice`);
        }
      }
      if (current.data.name === "Duke") {
        if (opponent && !this.isImmuneToAbilities(opponent, current)) {
          this.addLog(`${current.data.name} spins ${opponent.data.name} back to deck`);
          const deck = side === 'player' ? this.enemyDeck : this.playerDeck;
          const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, ...baseData } = opponent.data;
          deck.push({ ...baseData });
          gsap.to(opponent.mesh.position, { y: 10, duration: 0.5, onComplete: () => {
            this.sceneManager.scene.remove(opponent.mesh);
            this.entityManager.remove(opponent);
          }});
          if (side === 'player') this.enemyBattlefield[idx] = null;
          else this.playerBattlefield[idx] = null;
        } else if (opponent) {
          this.addLog(`${opponent.data.name} is immune to ${current.data.name}'s spin`);
        }
      }
      if (current.data.needsAllocation) {
        await this.allocateCounters(current, side === 'enemy');
      }
      if (current.data.hasTargetedAbility) {
        await this.handleTargetedAbility(current, side === 'enemy');
      }
      if (current.data.hasGlobalAbility) {
        await this.executeGlobalAbility(current);
      }
      if (current.data.hasSealTargetAbility) {
        await this.handleSealTargetAbility(current, side === 'enemy');
      }
      
      // Refresh references after abilities
      pCard = this.playerBattlefield[idx];
      eCard = this.enemyBattlefield[idx];
    }

    if (pCard) pCard.data.faceUp = true;
    if (eCard) eCard.data.faceUp = true;

    // Delay before combat to ensure flip effects are assigned
    await new Promise(r => setTimeout(r, 1000));

    // Step C: Battle
    this.updateState({ phaseStep: "Step C: Battle" });
    let pStymied = false;
    let eStymied = false;
    
    // Champion must be defeated first
    if (pCard && seal.champion && seal.champion.data.isEnemy) {
      this.addLog(`Player ${pCard.data.name} battles Enemy Champion ${seal.champion.data.name}`);
      pStymied = await this.handleBattle(pCard, seal.champion, idx, true);
      pCard = this.playerBattlefield[idx];
    }
    
    // If player card survived or champion was defeated, enemy card can try to battle player champion
    if (eCard && seal.champion && !seal.champion.data.isEnemy) {
      this.addLog(`Enemy ${eCard.data.name} battles Player Champion ${seal.champion.data.name}`);
      eStymied = await this.handleBattle(eCard, seal.champion, idx, true);
      eCard = this.enemyBattlefield[idx];
    }

    // Finally, battle between the cards behind the champion (if they survived and aren't blocked)
    const pBlocked = seal.champion && seal.champion.data.isEnemy;
    const eBlocked = seal.champion && !seal.champion.data.isEnemy;

    if (pCard && eCard && !pBlocked && !eBlocked) {
      this.addLog(`Battle: ${pCard.data.name} vs ${eCard.data.name}`);
      const battleStymied = await this.handleBattle(pCard, eCard, idx, false);
      if (battleStymied) {
        pStymied = true;
        eStymied = true;
      }
    }

    // Step D: Siege
    this.updateState({ phaseStep: "Step D: Siege" });
    pCard = this.playerBattlefield[idx];
    eCard = this.enemyBattlefield[idx];

    if (pStymied || eStymied) {
      this.addLog(`Seal ${idx + 1} remains Neutral due to Stymied combat.`);
      this.claimSeal(idx, Alignment.NEUTRAL);
    } else {
      if (pCard && !pBlocked) await this.handleSiege(idx, pCard, true);
      else if (eCard && !eBlocked) await this.handleSiege(idx, eCard, false);
    }

    // Step E: Ascension
    this.updateState({ phaseStep: "Step E: Ascension" });
    const survivor = this.playerBattlefield[idx] || this.enemyBattlefield[idx];
    if (survivor && survivor.data.isChampion && !seal.champion) {
      this.ascendToSeal(survivor, idx);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  private async handleBattle(attacker: CardEntity, defender: CardEntity, idx: number, isAgainstChamp: boolean): Promise<boolean> {
    const aPow = attacker.data.power + attacker.data.powerMarkers - attacker.data.weaknessMarkers;
    const dPow = defender.data.power + defender.data.powerMarkers - defender.data.weaknessMarkers;

    const isAProtected = this.isProtected(attacker);
    const isDProtected = this.isProtected(defender);
    let stymied = false;

    if (aPow > dPow) {
      if (!defender.data.isInvincible && !isDProtected) {
        this.addLog(`${attacker.data.name} defeats ${defender.data.name}`);
        this.handleFinalAct(defender, attacker);
        this.destroyCard(defender, defender.data.isEnemy, idx, isAgainstChamp);
        this.handlePostCombat(attacker);
      } else {
        this.addLog(`${defender.data.name} is Protected or Invincible. ${attacker.data.name} is stymied.`);
        stymied = true;
      }
    } else if (dPow > aPow) {
      if (!attacker.data.isInvincible && !isAProtected) {
        this.addLog(`${defender.data.name} defeats ${attacker.data.name}`);
        this.handleFinalAct(attacker, defender);
        this.destroyCard(attacker, attacker.data.isEnemy, idx, false);
        this.handlePostCombat(defender);
      } else {
        this.addLog(`${attacker.data.name} is Protected or Invincible. ${defender.data.name} is stymied.`);
        stymied = true;
      }
    } else {
      this.addLog(`Mutual destruction: ${attacker.data.name} and ${defender.data.name}`);
      if (!attacker.data.isInvincible && !isAProtected) {
        this.handleFinalAct(attacker, defender);
        this.destroyCard(attacker, attacker.data.isEnemy, idx, false);
      } else if (attacker.data.isInvincible) {
        stymied = true;
      }
      if (!defender.data.isInvincible && !isDProtected) {
        this.handleFinalAct(defender, attacker);
        this.destroyCard(defender, defender.data.isEnemy, idx, isAgainstChamp);
      } else if (defender.data.isInvincible) {
        stymied = true;
      }
    }
    await new Promise(r => setTimeout(r, 500));
    return stymied;
  }

  private handleFinalAct(dying: CardEntity, killer: CardEntity) {
    if (dying.data.name === "Saint Michael") {
      killer.data.weaknessMarkers += 3;
      killer.updateVisualMarkers();
    }
  }

  private isImmuneToAbilities(target: CardEntity, source: CardEntity): boolean {
    if (source.data.type !== 'Creature') return false;
    if (target.data.faction !== 'Celestial') return false;
    
    const seraphimOnSeal = this.seals.find(s => 
      s.champion && 
      s.champion.data.name === "Seraphim" && 
      s.champion.data.isEnemy === target.data.isEnemy
    );
    
    if (seraphimOnSeal && seraphimOnSeal.champion !== target) return true;
    return false;
  }

  private isProtected(card: CardEntity): boolean {
    return false;
  }

  private handlePostCombat(winner: CardEntity) {
    if (winner.data.name === "The Inevitable" || winner.data.name === "War" || winner.data.name === "Alpha") {
      const gain = (winner.data.name === "War" ? 3 : 2);
      winner.data.powerMarkers += gain;
      winner.updateVisualMarkers();
      this.addLog(`${winner.data.name} gains ${gain} Power Markers from victory`);
    }
  }

  private addLog(msg: string) {
    const newLogs = [...this.state.logs, msg];
    if (newLogs.length > 50) newLogs.shift();
    this.updateState({ logs: newLogs });
  }

  private zoomOut() {
    gsap.to(this.sceneManager.camera.position, { x: 0, y: 28, z: 32, duration: 1.2, ease: "power2.inOut" });
    gsap.to(this.sceneManager.cameraTarget, { x: 0, y: 0, z: -2, duration: 1.2, ease: "power2.inOut" });
  }

  private zoomIn(idx: number) {
    const seal = this.seals[idx];
    gsap.to(this.sceneManager.camera.position, { x: seal.mesh.position.x, y: 14, z: 14, duration: 1, ease: "power2.inOut" });
    gsap.to(this.sceneManager.cameraTarget, { x: seal.mesh.position.x, y: 0, z: 0, duration: 1, ease: "power2.inOut" });
  }

  private async handleSiege(idx: number, attacker: CardEntity | null, isPlayer: boolean) {
    const seal = this.seals[idx];
    const aPow = attacker ? attacker.data.power + attacker.data.powerMarkers - attacker.data.weaknessMarkers : 0;
    
    if (aPow > 0 || !attacker) {
      const pAlign = this.state.playerAlignment;
      const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
      const targetAlign = isPlayer ? pAlign : eAlign;
      this.addLog(`${isPlayer ? 'Player' : 'Enemy'} influences Seal ${idx + 1} towards ${targetAlign}`);
      this.claimSeal(idx, targetAlign);
    }
  }

  private ascendToSeal(card: CardEntity, idx: number) {
    if (card.data.isEnemy) this.enemyBattlefield[idx] = null;
    else this.playerBattlefield[idx] = null;
    
    this.addLog(`${card.data.name} ascends to Seal ${idx + 1}`);
    this.seals[idx].champion = card;
    gsap.to(card.mesh.position, {
      x: this.seals[idx].mesh.position.x,
      y: 0.6,
      z: 0,
      duration: 0.6,
      ease: "back.out"
    });
  }

  private async allocateCounters(card: CardEntity, isAI: boolean) {
    const data = card.data;
    let powerPool = data.markerPower || 0;
    let weaknessPool = data.markerWeakness || 0;

    this.pendingAbilityData = { source: card };

    if (isAI) {
      const myUnits = this.enemyBattlefield.filter(c => c !== null) as CardEntity[];
      const enemyUnits = this.playerBattlefield.filter(c => c !== null) as CardEntity[];
      
      for (let i = 0; i < powerPool; i++) {
        if (myUnits.length > 0) {
          if (!this.isImmuneToAbilities(myUnits[0], card)) {
            myUnits[0].data.powerMarkers++;
            myUnits[0].updateVisualMarkers();
          } else {
            this.addLog(`${myUnits[0].data.name} is immune to markers from ${card.data.name}`);
          }
        }
      }
      for (let i = 0; i < weaknessPool; i++) {
        if (enemyUnits.length > 0) {
          if (!this.isImmuneToAbilities(enemyUnits[0], card)) {
            enemyUnits[0].data.weaknessMarkers++;
            enemyUnits[0].updateVisualMarkers();
          } else {
            this.addLog(`${enemyUnits[0].data.name} is immune to markers from ${card.data.name}`);
          }
        }
      }
      this.pendingAbilityData = null;
      return Promise.resolve();
    } else {
      this.updateState({ 
        currentPhase: Phase.COUNTER_ALLOCATION, 
        powerPool, 
        weaknessPool,
        abilitySourceCardName: card.data.name
      });
      this.zoomOut();
      return new Promise<void>((resolve) => {
        this.resolutionCallback = resolve;
      });
    }
  }

  private async handleTargetedAbility(source: CardEntity, isAI: boolean) {
    const data = source.data;
    this.pendingAbilityData = { source, effect: data.effect, targetType: data.targetType };

    if (isAI) {
      const targets = [...this.playerBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null && !c.data.isEnemy) as CardEntity[];
      if (targets.length > 0) {
        targets.sort((a, b) => b.data.power - a.data.power);
        this.applyAbilityEffect(targets[0]);
      }
      this.pendingAbilityData = null;
      return Promise.resolve();
    } else {
      this.updateState({ 
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: `Select a target to ${data.effect?.toUpperCase()}.`
      });
      this.zoomOut();
      return new Promise<void>((resolve) => {
        this.resolutionCallback = resolve;
      });
    }
  }

  private async handleSealTargetAbility(source: CardEntity, isAI: boolean) {
    const effect = source.data.sealEffect as Alignment;
    if (isAI) {
      const targetAlign = effect === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
      const validSeals = this.seals.filter(s => !s.champion && (s.alignment === targetAlign || s.alignment === Alignment.NEUTRAL));
      if (validSeals.length > 0) this.claimSeal(validSeals[0].index, effect);
      return Promise.resolve();
    } else {
      this.updateState({ 
        currentPhase: Phase.SEAL_TARGETING,
        instructionText: `Select an undefended seal to ${effect === Alignment.LIGHT ? 'PURIFY' : 'CORRUPT'}.`
      });
      this.zoomOut();
      this.pendingAbilityData = { source, effect };
      return new Promise<void>((resolve) => {
        this.resolutionCallback = resolve;
      });
    }
  }

  private async executeGlobalAbility(source: CardEntity) {
    const effect = source.data.effect;
    if (effect === 'siphon_all') {
      const allCards = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null && c !== source) as CardEntity[];
      let totalP = 0, totalW = 0;
      allCards.forEach(c => {
        totalP += c.data.powerMarkers;
        totalW += c.data.weaknessMarkers;
        c.data.powerMarkers = 0;
        c.data.weaknessMarkers = 0;
        c.updateVisualMarkers();
      });
      source.data.powerMarkers += totalP;
      source.data.weaknessMarkers += totalW;
      source.updateVisualMarkers();
    } else if (effect === 'corrupt_undefended') {
      this.seals.filter(s => !s.champion && s.alignment === Alignment.LIGHT).forEach(s => this.claimSeal(s.index, Alignment.DARK));
    }
    await new Promise(r => setTimeout(r, 600));
  }

  private applyAbilityEffect(target: CardEntity) {
    if (!this.pendingAbilityData) return;
    const { effect, source } = this.pendingAbilityData;
    
    if (this.isImmuneToAbilities(target, source)) {
      this.addLog(`${target.data.name} is immune to ${source.data.name}'s ability`);
      return;
    }

    if (target.data.isInvincible && effect !== 'destroy_marker') return;

    if (effect === 'destroy_marker') {
      if (target.data.powerMarkers > 0) {
        target.data.powerMarkers--;
        this.addLog(`${source.data.name} destroys a Power Marker on ${target.data.name}`);
      } else if (target.data.weaknessMarkers > 0) {
        target.data.weaknessMarkers--;
        this.addLog(`${source.data.name} destroys a Weakness Marker on ${target.data.name}`);
      } else {
        this.addLog(`No markers to destroy on ${target.data.name}`);
      }
      target.updateVisualMarkers();
    } else if (effect === 'destroy') {
      const idxP = this.playerBattlefield.indexOf(target);
      const idxE = this.enemyBattlefield.indexOf(target);
      const seal = this.seals.find(s => s.champion === target);
      if (seal) {
        this.destroyCard(target, target.data.isEnemy, seal.index, true);
        seal.champion = null;
      } else if (idxP !== -1) this.destroyCard(target, false, idxP, false);
      else if (idxE !== -1) this.destroyCard(target, true, idxE, false);
    } else if (effect === 'return') {
      const idxP = this.playerBattlefield.indexOf(target);
      const idxE = this.enemyBattlefield.indexOf(target);
      const seal = this.seals.find(s => s.champion === target);
      
      if (seal) seal.champion = null;
      else if (idxP !== -1) this.playerBattlefield[idxP] = null;
      else if (idxE !== -1) this.enemyBattlefield[idxE] = null;

      const deck = target.data.isEnemy ? this.enemyDeck : this.playerDeck;
      const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, ...baseData } = target.data;
      deck.push({ ...baseData });
      gsap.to(target.mesh.position, { y: 10, duration: 0.5, onComplete: () => {
        this.sceneManager.scene.remove(target.mesh);
        this.entityManager.remove(target);
      }});
    }
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

  private finalizeGame() {
    const pAlign = this.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    const pCount = this.seals.filter(s => s.alignment === pAlign).length;
    const eCount = this.seals.filter(s => s.alignment === eAlign).length;

    let body = "";

    if (pCount > eCount) {
      body = pAlign === Alignment.LIGHT 
        ? "The Seventh Seal is Purified. The cycle of Light begins anew, casting away the shadows of the void."
        : "The Void has consumed the threshold. The world yields to the eternal rhythm of the Dark.";
      this.addLog("GAME OVER: Player Victory");
    } else if (eCount > pCount) {
      body = pAlign === Alignment.LIGHT
        ? "The Light has flickered out. The opponent's corruption has claimed the world's essence."
        : "The Light has unexpectedly pierced the veil. Your dominion of shadow has been repelled.";
      this.addLog("GAME OVER: Enemy Victory");
    } else {
      body = "The scales remain perfectly balanced. Neither Light nor Shadow can claim the throne of existence.";
      this.addLog("GAME OVER: Draw");
    }

    this.updateState({ 
      currentPhase: Phase.GAME_OVER, 
      instructionText: body 
    });
  }

  private destroyCard(card: CardEntity, isEnemy: boolean, idx: number, isAgainstChamp: boolean = false) {
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

  private claimSeal(idx: number, status: Alignment) {
    // Luna: Final Act: Nullify enemy Influence change.
    const hasLuna = [...this.playerLimbo, ...this.enemyLimbo].some(c => c.data.name === "Luna" && c.data.isEnemy !== (status === Alignment.DARK));
    if (hasLuna) return;

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
      this.finalizeGame();
    } else if (this.state.enemyScore >= 7) {
      this.finalizeGame();
    }

    this.updateState({});
  }

  private handleMouseMove(event: MouseEvent) {
    const allCards = [...this.playerHand, ...this.playerBattlefield, ...this.enemyBattlefield].filter(c => c !== null) as CardEntity[];
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

  private handleMouseDown(event: MouseEvent) {
    if (this.state.currentPhase === Phase.PREP) {
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
    } else if (this.state.currentPhase === Phase.ABILITY_TARGETING) {
      const allBoard = [...this.playerBattlefield, ...this.enemyBattlefield, ...this.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[];
      const intersects = this.inputHandler.raycaster.intersectObjects(allBoard.map(c => c.mesh), true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !(obj instanceof THREE.Group)) obj = obj.parent;
        const card = allBoard.find(c => c.mesh === obj);
        if (card) {
          this.applyAbilityEffect(card);
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
        if (seal && !seal.champion) {
          this.claimSeal(seal.index, this.pendingAbilityData.effect);
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

  private updateState(patch: Partial<GameState>) {
    this.state = { 
      ...this.state, 
      ...patch,
      playerDeckCount: this.playerDeck.length,
      enemyDeckCount: this.enemyDeck.length
    };
    this.onStateChange(this.state);
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
