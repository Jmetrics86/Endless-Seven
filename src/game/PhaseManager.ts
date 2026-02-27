import gsap from 'gsap';
import { Phase, Alignment, CardData } from '../types';
import { CardEntity } from '../entities/CardEntity';
import { IGameController } from './interfaces';
import { GAME_CONSTANTS } from '../constants';

export class PhaseManager {
  constructor(private controller: IGameController) {}

  public async startPrepPhase() {
    if (this.controller.isProcessing) return;
    this.controller.isProcessing = true;
    this.controller.addLog(`--- Round ${this.controller.state.currentRound} Prep Phase ---`);
    this.controller.updateState({ currentPhase: Phase.PREP, phaseStep: 'Step 1: Draw Hand', lockedSealIndex: -1 });

    // Clear temporary invincibility from previous rounds
    [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
      .filter(c => c !== null)
      .forEach(c => {
        if (c!.data.isInvincible) {
          c!.data.isInvincible = false;
          this.controller.addLog(`${c!.data.name}'s Invulnerability fades.`);
        }
      });

    for (let i = 0; i < 8; i++) {
      if (this.controller.playerDeck.length === 0) break;
      const cardData = this.controller.playerDeck.pop()!;
      const card = new CardEntity(cardData, false, this.controller.state.playerAlignment);
      this.controller.entityManager.add(card);
      card.mesh.position.set(-15, 2, 6); // Deck position
      this.controller.sceneManager.scene.add(card.mesh);
      this.controller.playerHand.push(card);

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
    this.controller.isProcessing = false;
    this.controller.updateState({ phaseStep: 'Step 3: Reinforce' });
  }

  private enemyReinforce() {
    const aiHand: CardData[] = [];
    for (let i = 0; i < 8; i++) { if (this.controller.enemyDeck.length > 0) aiHand.push(this.controller.enemyDeck.pop()!); }
    
    const vacantSlots = this.controller.enemyBattlefield.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
    for (let i = 0; i < vacantSlots.length && aiHand.length > 0; i++) {
      const slotIdx = vacantSlots[i];
      const cardData = aiHand.shift()!;
      const card = new CardEntity(cardData, true, this.controller.state.playerAlignment);
      this.controller.entityManager.add(card);
      card.mesh.position.set(-15, 2, -6);
      card.mesh.rotation.x = Math.PI;
      this.controller.sceneManager.scene.add(card.mesh);
      this.controller.enemyBattlefield[slotIdx] = card;

      gsap.to(card.mesh.position, {
        x: (slotIdx - 3) * GAME_CONSTANTS.SLOT_SPACING,
        y: 0.1,
        z: -3.2,
        duration: 0.8,
        delay: i * 0.15
      });
    }
    this.controller.updateState({});
  }

  public endPrep() {
    if (this.controller.isProcessing) return;
    this.controller.isProcessing = true;
    this.controller.addLog("Ending Prep Phase. Purging hand...");
    this.controller.updateState({ phaseStep: 'Purging hand...' });

    this.controller.playerHand.forEach((card, i) => {
      this.controller.playerLimbo.push(card);
      gsap.to(card.mesh.position, {
        x: 15,
        y: 0.2 + (this.controller.playerLimbo.length * 0.05),
        z: 6,
        duration: 0.6,
        delay: i * 0.05,
        onComplete: () => {
          card.mesh.rotation.set(0, 0, 0);
          card.updateVisualMarkers();
        }
      });
    });
    (this.controller as any).playerHand = [];
    setTimeout(() => this.startResolution(), 800);
  }

  public async startResolution() {
    this.controller.updateState({ currentPhase: Phase.RESOLUTION });
    this.controller.addLog("--- Resolution Phase Started ---");
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      if (this.controller.state.currentPhase === Phase.GAME_OVER) break;
      await this.resolveSeal(i);
    }
    
    if (this.controller.state.currentPhase !== Phase.GAME_OVER) {
      // Reset camera
      gsap.to(this.controller.sceneManager.camera.position, { x: 0, y: 28, z: 32, duration: 1.5, ease: "power2.inOut" });
      gsap.to(this.controller.sceneManager.cameraTarget, { x: 0, y: 0, z: -2, duration: 1.5, ease: "power2.inOut" });
      await new Promise(r => setTimeout(r, 1600));

      if (this.controller.state.currentRound >= 3) {
        this.finalizeGame();
      } else {
        this.controller.state.currentRound++;
        this.controller.isProcessing = false;
        this.startPrepPhase();
      }
    }
  }

  public async resolveSeal(idx: number) {
    this.controller.currentResolvingSealIndex = idx;
    const seal = this.controller.seals[idx];
    this.controller.updateState({ phaseStep: `Resolving Seal ${idx + 1}` });
    this.controller.addLog(`Resolving Seal ${idx + 1}...`);
    
    this.controller.zoomIn(idx);
    await new Promise(r => setTimeout(r, 1000));

    let pCard = this.controller.playerBattlefield[idx];
    let eCard = this.controller.enemyBattlefield[idx];

    // Step 0: Haste Check
    const pHaste = pCard && pCard.data.hasHaste;
    const eHaste = eCard && eCard.data.hasHaste;

    if (pHaste || eHaste) {
      this.controller.updateState({ phaseStep: "Step 0: Haste Strike" });
      if (pCard && eCard) await this.controller.handleBattle(pCard, eCard, idx, false);
      else if (pCard && seal.champion && seal.champion.data.isEnemy) await this.controller.handleBattle(pCard, seal.champion, idx, true);
      else if (eCard && seal.champion && !seal.champion.data.isEnemy) await this.controller.handleBattle(eCard, seal.champion, idx, true);
      
      pCard = this.controller.playerBattlefield[idx];
      eCard = this.controller.enemyBattlefield[idx];
    }

    // Step A: The Flip
    this.controller.updateState({ phaseStep: "Step A: The Flip" });
    const pFlipping = pCard && !pCard.data.faceUp;
    const eFlipping = eCard && !eCard.data.faceUp;
    if (pFlipping) {
      gsap.to(pCard.mesh.rotation, { x: 0, duration: 0.5 });
      this.controller.addLog(`Player reveals ${pCard.data.name}`);
    }
    if (eFlipping) {
      gsap.to(eCard.mesh.rotation, { x: 0, duration: 0.5 });
      this.controller.addLog(`Enemy reveals ${eCard.data.name}`);
    }
    if (pFlipping || eFlipping) await new Promise(r => setTimeout(r, 800));

    // Step B: Flip & Activate Abilities
    this.controller.updateState({ phaseStep: "Step B: Abilities" });
    this.controller.addLog("Processing Abilities...");
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
        isFlipping = false;
      }

      if (!current || current.data.isSuppressed) continue;
      
      const isActivate = current.data.hasActivate;
      if (!isFlipping && !isActivate) continue;

      // Fallen One Nullify Check
      const nullified = await this.controller.abilityManager.checkNullify(current);
      if (nullified) continue;

      // Nullify
      if (current.data.hasNullify) {
        if (opponent && !opponent.data.faceUp && !this.controller.abilityManager.isImmuneToAbilities(opponent, current)) {
          opponent.data.faceUp = true;
          opponent.data.isSuppressed = true;
          opponent.updateVisualMarkers();
          this.controller.addLog(`${current.data.name} reveals and nullifies ${opponent.data.name}`);
          gsap.to(opponent.mesh.rotation, { x: 0, duration: 0.5 });
        } else if (opponent && opponent.data.faceUp) {
          this.controller.addLog(`${current.data.name}'s nullify fails: ${opponent.data.name} is already revealed.`);
        } else if (opponent) {
          this.controller.addLog(`${opponent.data.name} is immune to ${current.data.name}'s nullify`);
        }
      }
      
      // Invulnerability
      if (current.data.ability.toLowerCase().includes("invulnerability") || current.data.name === "Nephilim") {
        current.data.isInvincible = true;
        this.controller.addLog(`${current.data.name} gains Invulnerability`);
      }

      // Nephilim Activate
      if (isActivate && current.data.name === "Nephilim") {
        await (this.controller.abilityManager as any).handleActivateAbility(current, side === 'enemy');
      }

      // Faction Presence
      if (current.data.name === "The Spinner" || current.data.name === "Omega" || current.data.name === "Lord") {
        const count = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
          .filter(c => c !== null && c.data.faction === current!.data.faction).length;
        current.data.powerMarkers += count;
        current.updateVisualMarkers();
        this.controller.addLog(`${current.data.name} gains ${count} Power Markers from faction presence`);
      }

      // Herald
      if (current.data.name === "Herald") {
        const deck = side === 'player' ? this.controller.playerDeck : this.controller.enemyDeck;
        if (deck.length > 0) {
          const topCard = deck[deck.length - 1];
          const markers = topCard.power;
          current.data.powerMarkers += markers;
          current.updateVisualMarkers();
          this.controller.addLog(`${current.data.name} gains ${markers} Power Markers from top of deck (${topCard.name})`);
        } else {
          this.controller.addLog(`${current.data.name} finds no cards in deck to gain markers from`);
        }
      }

      // Beta
      if (current.data.name === "Beta") {
        const neighbors = [];
        if (idx > 0) neighbors.push(side === 'player' ? this.controller.playerBattlefield[idx-1] : this.controller.enemyBattlefield[idx-1]);
        if (idx < 6) neighbors.push(side === 'player' ? this.controller.playerBattlefield[idx+1] : this.controller.enemyBattlefield[idx+1]);
        neighbors.forEach(n => {
          if (n) {
            n.data.powerMarkers += 2;
            n.updateVisualMarkers();
          }
        });
        current.data.isInvincible = true;
        this.controller.addLog(`${current.data.name} buffs neighbors and gains Invulnerability`);
      }

      // Lust
      if (current.data.name === "Lust") {
        if (opponent && !this.controller.abilityManager.isImmuneToAbilities(opponent, current)) {
          this.controller.addLog(`${current.data.name} forces mutual sacrifice with ${opponent.data.name}`);
          this.controller.destroyCard(current, side === 'enemy', idx, false);
          this.controller.destroyCard(opponent, side === 'player' ? false : true, idx, false);
        } else if (opponent) {
          this.controller.addLog(`${opponent.data.name} is immune to ${current.data.name}'s sacrifice`);
        }
      }

      // Duke
      if (current.data.name === "Duke") {
        if (opponent && !this.controller.abilityManager.isImmuneToAbilities(opponent, current)) {
          this.controller.addLog(`${current.data.name} spins ${opponent.data.name} back to deck`);
          const deck = side === 'player' ? this.controller.enemyDeck : this.controller.playerDeck;
          const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, ...baseData } = opponent.data;
          deck.push({ ...baseData });
          gsap.to(opponent.mesh.position, { y: 10, duration: 0.5, onComplete: () => {
            this.controller.disposeCard(opponent!);
          }});
          if (side === 'player') this.controller.enemyBattlefield[idx] = null;
          else this.controller.playerBattlefield[idx] = null;
        } else if (opponent) {
          this.controller.addLog(`${opponent.data.name} is immune to ${current.data.name}'s spin`);
        }
      }

      if (current.data.needsAllocation) {
        await this.controller.allocateCounters(current, side === 'enemy');
      }
      if (current.data.hasTargetedAbility) {
        await this.controller.handleTargetedAbility(current, side === 'enemy');
      }
      if (current.data.hasGlobalAbility) {
        await this.controller.executeGlobalAbility(current);
      }
      if (current.data.hasSealTargetAbility) {
        await this.controller.handleSealTargetAbility(current, side === 'enemy');
      }
      
      pCard = this.controller.playerBattlefield[idx];
      eCard = this.controller.enemyBattlefield[idx];
    }

    if (pCard) pCard.data.faceUp = true;
    if (eCard) eCard.data.faceUp = true;

    // Step C: Combat
    this.controller.updateState({ phaseStep: "Step C: Combat" });
    let pStymied = false;
    let eStymied = false;

    if (pCard && seal.champion && seal.champion.data.isEnemy) {
      this.controller.addLog(`Player ${pCard.data.name} battles Enemy Champion ${seal.champion.data.name}`);
      pStymied = await this.controller.handleBattle(pCard, seal.champion, idx, true);
      pCard = this.controller.playerBattlefield[idx];
    }
    if (eCard && seal.champion && !seal.champion.data.isEnemy) {
      this.controller.addLog(`Enemy ${eCard.data.name} battles Player Champion ${seal.champion.data.name}`);
      eStymied = await this.controller.handleBattle(eCard, seal.champion, idx, true);
      eCard = this.controller.enemyBattlefield[idx];
    }

    const pBlocked = seal.champion && seal.champion.data.isEnemy;
    const eBlocked = seal.champion && !seal.champion.data.isEnemy;

    if (pCard && eCard && !pBlocked && !eBlocked) {
      this.controller.addLog(`Battle: ${pCard.data.name} vs ${eCard.data.name}`);
      const battleStymied = await this.controller.handleBattle(pCard, eCard, idx, false);
      if (battleStymied) {
        pStymied = true;
        eStymied = true;
      }
    }

    // Step D: Siege
    this.controller.updateState({ phaseStep: "Step D: Siege" });
    pCard = this.controller.playerBattlefield[idx];
    eCard = this.controller.enemyBattlefield[idx];

    if (pStymied || eStymied) {
      this.controller.addLog(`Seal ${idx + 1} remains Neutral due to Stymied combat.`);
      this.controller.claimSeal(idx, Alignment.NEUTRAL);
    } else {
      if (pCard && !pBlocked) await this.controller.handleSiege(idx, pCard, true);
      else if (eCard && !eBlocked) await this.controller.handleSiege(idx, eCard, false);
    }

    // Step E: Ascension
    this.controller.updateState({ phaseStep: "Step E: Ascension" });
    const survivor = this.controller.playerBattlefield[idx] || this.controller.enemyBattlefield[idx];
    if (survivor && survivor.data.isChampion && !seal.champion) {
      this.controller.ascendToSeal(survivor, idx);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  public async handleBattle(attacker: CardEntity, defender: CardEntity, idx: number, isAgainstChamp: boolean): Promise<boolean> {
    const aPow = attacker.data.power + attacker.data.powerMarkers - attacker.data.weaknessMarkers;
    const dPow = defender.data.power + defender.data.powerMarkers - defender.data.weaknessMarkers;

    const isAProtected = this.controller.abilityManager.isProtected(attacker);
    const isDProtected = this.controller.abilityManager.isProtected(defender);
    let stymied = false;

    if (aPow > dPow) {
      if (!defender.data.isInvincible && !isDProtected) {
        this.controller.addLog(`${attacker.data.name} defeats ${defender.data.name}`);
        this.controller.abilityManager.handleFinalAct(defender, attacker);
        this.controller.destroyCard(defender, defender.data.isEnemy, idx, isAgainstChamp);
        this.controller.abilityManager.handlePostCombat(attacker);
      } else {
        this.controller.addLog(`${defender.data.name} is Protected or Invincible. ${attacker.data.name} is stymied.`);
        stymied = true;
      }
    } else if (dPow > aPow) {
      if (!attacker.data.isInvincible && !isAProtected) {
        this.controller.addLog(`${defender.data.name} defeats ${attacker.data.name}`);
        this.controller.abilityManager.handleFinalAct(attacker, defender);
        this.controller.destroyCard(attacker, attacker.data.isEnemy, idx, false);
        this.controller.abilityManager.handlePostCombat(defender);
      } else {
        this.controller.addLog(`${attacker.data.name} is Protected or Invincible. ${defender.data.name} is stymied.`);
        stymied = true;
      }
    } else {
      this.controller.addLog(`Mutual destruction: ${attacker.data.name} and ${defender.data.name}`);
      if (!attacker.data.isInvincible && !isAProtected) {
        this.controller.abilityManager.handleFinalAct(attacker, defender);
        this.controller.destroyCard(attacker, attacker.data.isEnemy, idx, false);
      } else if (attacker.data.isInvincible) {
        stymied = true;
      }
      if (!defender.data.isInvincible && !isDProtected) {
        this.controller.abilityManager.handleFinalAct(defender, attacker);
        this.controller.destroyCard(defender, defender.data.isEnemy, idx, isAgainstChamp);
      } else if (defender.data.isInvincible) {
        stymied = true;
      }
    }
    await new Promise(r => setTimeout(r, 500));
    return stymied;
  }

  public async handleSiege(idx: number, attacker: CardEntity | null, isPlayer: boolean) {
    const aPow = attacker ? attacker.data.power + attacker.data.powerMarkers - attacker.data.weaknessMarkers : 0;
    
    if (aPow > 0 || !attacker) {
      const pAlign = this.controller.state.playerAlignment;
      const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
      const targetAlign = isPlayer ? pAlign : eAlign;
      this.controller.addLog(`${isPlayer ? 'Player' : 'Enemy'} influences Seal ${idx + 1} towards ${targetAlign}`);
      this.controller.claimSeal(idx, targetAlign);
    }
  }

  public checkGameOver() {
    const pAlign = this.controller.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    const pCount = this.controller.seals.filter(s => s.alignment === pAlign).length;
    const eCount = this.controller.seals.filter(s => s.alignment === eAlign).length;

    if (pCount >= 4 || eCount >= 4 || (this.controller.playerDeck.length === 0 && this.controller.enemyDeck.length === 0)) {
      this.finalizeGame();
    }
  }

  public finalizeGame() {
    const pAlign = this.controller.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    const pCount = this.controller.seals.filter(s => s.alignment === pAlign).length;
    const eCount = this.controller.seals.filter(s => s.alignment === eAlign).length;

    let body = "";

    if (pCount > eCount) {
      body = pAlign === Alignment.LIGHT 
        ? "The Seventh Seal is Purified. The cycle of Light begins anew, casting away the shadows of the void."
        : "The Void has consumed the threshold. The world yields to the eternal rhythm of the Dark.";
      this.controller.addLog("GAME OVER: Player Victory");
    } else if (eCount > pCount) {
      body = pAlign === Alignment.LIGHT
        ? "The Light has flickered out. The opponent's corruption has claimed the world's essence."
        : "The Light has unexpectedly pierced the veil. Your dominion of shadow has been repelled.";
      this.controller.addLog("GAME OVER: Enemy Victory");
    } else {
      body = "The scales remain perfectly balanced. Neither Light nor Shadow can claim the throne of existence.";
      this.controller.addLog("GAME OVER: Draw");
    }

    this.controller.updateState({ 
      currentPhase: Phase.GAME_OVER, 
      instructionText: body 
    });
  }

  public zoomOut() {
    gsap.to(this.controller.sceneManager.camera.position, { x: 0, y: 28, z: 32, duration: 1.2, ease: "power2.inOut" });
    gsap.to(this.controller.sceneManager.cameraTarget, { x: 0, y: 0, z: -2, duration: 1.2, ease: "power2.inOut" });
  }

  public zoomIn(idx: number) {
    const seal = this.controller.seals[idx];
    gsap.to(this.controller.sceneManager.camera.position, { x: seal.mesh.position.x, y: 14, z: 14, duration: 1, ease: "power2.inOut" });
    gsap.to(this.controller.sceneManager.cameraTarget, { x: seal.mesh.position.x, y: 0, z: 0, duration: 1, ease: "power2.inOut" });
  }

  public ascendToSeal(card: CardEntity, idx: number) {
    if (card.data.isEnemy) this.controller.enemyBattlefield[idx] = null;
    else this.controller.playerBattlefield[idx] = null;
    
    this.controller.addLog(`${card.data.name} ascends to Seal ${idx + 1}`);
    this.controller.seals[idx].champion = card;
    gsap.to(card.mesh.position, {
      x: this.controller.seals[idx].mesh.position.x,
      y: 0.6,
      z: 0,
      duration: 0.6,
      ease: "back.out"
    });
  }
}
