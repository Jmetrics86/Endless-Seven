import { CardEntity } from '../entities/CardEntity';
import { Alignment, Phase } from '../types';
import { IGameController } from './interfaces';
import gsap from 'gsap';

export class AbilityManager {
  constructor(private controller: IGameController) {}

  public isImmuneToAbilities(target: CardEntity, source: CardEntity): boolean {
    if (source.data.type !== 'Creature') return false;
    if (target.data.abilityImmune) return true;
    if (target.data.faction !== 'Celestial') return false;
    
    const seraphimOnSeal = this.controller.seals.find(s => 
      s.champion && 
      s.champion.data.name === "Seraphim" && 
      s.champion.data.isEnemy === target.data.isEnemy
    );
    
    if (seraphimOnSeal && seraphimOnSeal.champion !== target) return true;
    return false;
  }

  public isProtected(card: CardEntity): boolean {
    return false;
  }

  public handleFinalAct(dying: CardEntity, killer: CardEntity) {
    // Saint Michael's Final Act is now from Limbo (destroy a card that battled this turn), not on death
  }

  public async handlePostCombat(winner: CardEntity): Promise<void> {
    if (winner.data.name === "War" || winner.data.name === "Alpha") {
      const horsemanCount = winner.data.name === "War" ? this.countHorsemenInPlay(winner.data.isEnemy) : 0;
      const gain = winner.data.name === "War" ? 2 * horsemanCount : 2;
      winner.data.powerMarkers += gain;
      winner.updateVisualMarkers();
      this.controller.addLog(`${winner.data.name} gains ${gain} Power Marker(s)${winner.data.name === "War" && horsemanCount > 0 ? ` (+2 per Horseman, ${horsemanCount} in play)` : ''}.`);
      return;
    }
    if (winner.data.name === "The Inevitable") {
      // After destroying a creature, you may destroy another card or Marker in play (only flipped cards)
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      if (allBoard.length === 0) return;
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "The Inevitable: Select a card or a card with Markers to destroy (card or one Marker)."
      });
      this.controller.zoomOut();
      await new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source: winner, effect: 'destroy_or_marker', targetType: 'any' };
      });
      return;
    }
  }

  public async executeGlobalAbility(source: CardEntity) {
    const effect = source.data.effect;
    if (effect === 'siphon_all') {
      const allCards = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && c !== source && (c as CardEntity).data.faceUp) as CardEntity[];
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
      for (const s of this.controller.seals.filter(s => !s.champion && s.alignment === Alignment.LIGHT)) {
        await this.controller.claimSeal(s.index, Alignment.DARK);
      }
    } else if (effect === 'siphon_power_only') {
      const allCards = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && c !== source && (c as CardEntity).data.faceUp) as CardEntity[];
      let totalP = 0;
      allCards.forEach(c => {
        totalP += c.data.powerMarkers;
        c.data.powerMarkers = 0;
        c.updateVisualMarkers();
      });
      source.data.powerMarkers += totalP;
      source.updateVisualMarkers();
      this.controller.addLog(`${source.data.name} transfers all Power Markers in play to itself.`);
    }
    await new Promise(r => setTimeout(r, 600));
  }

  public applyAbilityEffect(target: CardEntity, pendingAbilityData: any) {
    if (!pendingAbilityData) return;
    const { effect, source } = pendingAbilityData;
    
    if (this.isImmuneToAbilities(target, source)) {
      this.controller.addLog(`${target.data.name} is immune to ${source.data.name}'s ability`);
      return;
    }

    // Indestructible blocks destroy/graveyard/limbo effects; return-to-deck is none of those, so allow it (e.g. Duke, Elder)
    if (target.data.isInvincible && effect !== 'destroy_marker' && effect !== 'return') return;

    if (effect === 'sentinel_absorb') {
      const powerValue = target.data.power;
      source.data.powerMarkers += powerValue;
      source.updateVisualMarkers();
      this.controller.addLog(`${source.data.name} gains ${powerValue} Power Markers from ${target.data.name}'s Power Value in Limbo.`);
      return;
    }

    if (effect === 'saint_michael_destroy') {
      const idxP = this.controller.playerBattlefield.indexOf(target);
      const idxE = this.controller.enemyBattlefield.indexOf(target);
      const seal = this.controller.seals.find(s => s.champion === target);
      const killedBy = { cardName: source.data.name, cause: 'ability' as const };
      if (seal) {
        this.controller.destroyCard(target, target.data.isEnemy, seal.index, true, killedBy);
        seal.champion = null;
      } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false, killedBy);
      else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false, killedBy);
      this.controller.addLog(`${source.data.name} is moved to the Graveyard.`);
      this.moveToGraveyard(source);
      return;
    }

    if (effect === 'destroy_or_marker') {
      if (target.data.powerMarkers > 0 || target.data.weaknessMarkers > 0) {
        if (target.data.powerMarkers > 0) {
          target.data.powerMarkers--;
          this.controller.addLog(`${source.data.name} destroys a Power Marker on ${target.data.name}.`);
        } else {
          target.data.weaknessMarkers--;
          this.controller.addLog(`${source.data.name} destroys a Weakness Marker on ${target.data.name}.`);
        }
        target.updateVisualMarkers();
      } else {
        const idxP = this.controller.playerBattlefield.indexOf(target);
        const idxE = this.controller.enemyBattlefield.indexOf(target);
        const seal = this.controller.seals.find(s => s.champion === target);
        const killedBy = { cardName: source.data.name, cause: 'ability' as const };
        if (seal) {
          this.controller.destroyCard(target, target.data.isEnemy, seal.index, true, killedBy);
          seal.champion = null;
        } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false, killedBy);
        else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false, killedBy);
      }
      return;
    }

    if (effect === 'destroy_marker') {
      if (target.data.powerMarkers > 0) {
        target.data.powerMarkers--;
        this.controller.addLog(`${source.data.name} destroys a Power Marker on ${target.data.name}`);
      } else if (target.data.weaknessMarkers > 0) {
        target.data.weaknessMarkers--;
        this.controller.addLog(`${source.data.name} destroys a Weakness Marker on ${target.data.name}`);
      } else {
        this.controller.addLog(`No markers to destroy on ${target.data.name}`);
      }
      target.updateVisualMarkers();
    } else if (effect === 'destroy') {
      const idxP = this.controller.playerBattlefield.indexOf(target);
      const idxE = this.controller.enemyBattlefield.indexOf(target);
      const seal = this.controller.seals.find(s => s.champion === target);
      const killedBy = { cardName: source.data.name, cause: 'ability' as const };
      if (seal) {
        this.controller.destroyCard(target, target.data.isEnemy, seal.index, true, killedBy);
        seal.champion = null;
      } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false, killedBy);
      else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false, killedBy);
    } else if (effect === 'return') {
      const idxP = this.controller.playerBattlefield.indexOf(target);
      const idxE = this.controller.enemyBattlefield.indexOf(target);
      const seal = this.controller.seals.find(s => s.champion === target);
      
      if (seal) seal.champion = null;
      else if (idxP !== -1) this.controller.playerBattlefield[idxP] = null;
      else if (idxE !== -1) this.controller.enemyBattlefield[idxE] = null;

      this.controller.addLog(`${source.data.name} places ${target.data.name} on top of its owner's deck`);
      const deck = target.data.isEnemy ? this.controller.enemyDeck : this.controller.playerDeck;
      const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, ...baseData } = target.data;
      deck.push({ ...baseData });
      gsap.to(target.mesh.position, { y: 10, duration: 0.5, onComplete: () => {
        this.controller.disposeCard(target);
      }});
    } else if (effect === 'place_power') {
      const amount = pendingAbilityData.markerPower ?? source.data.markerPower ?? 3;
      target.data.powerMarkers += amount;
      target.updateVisualMarkers();
      this.controller.addLog(`${source.data.name} places +${amount} Power Marker(s) on ${target.data.name}`);
    } else if (effect === 'place_weakness') {
      const amount = pendingAbilityData.markerWeakness ?? source.data.markerWeakness ?? 3;
      target.data.weaknessMarkers += amount;
      target.updateVisualMarkers();
      this.controller.addLog(`${source.data.name} places -${amount} Weakness Marker(s) on ${target.data.name}`);
    } else if (effect === 'destroy_creature_with_weakness') {
      const idxP = this.controller.playerBattlefield.indexOf(target);
      const idxE = this.controller.enemyBattlefield.indexOf(target);
      const seal = this.controller.seals.find(s => s.champion === target);
      const killedBy = { cardName: source.data.name, cause: 'ability' as const };
      if (seal) {
        this.controller.destroyCard(target, target.data.isEnemy, seal.index, true, killedBy);
        seal.champion = null;
      } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false, killedBy);
      else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false, killedBy);
    }
  }

  /** Return a creature to top of its owner's deck (e.g. Elder's effect). */
  public returnCreatureToOwnerDeck(target: CardEntity) {
    const idxP = this.controller.playerBattlefield.indexOf(target);
    const idxE = this.controller.enemyBattlefield.indexOf(target);
    const seal = this.controller.seals.find(s => s.champion === target);
    if (seal) seal.champion = null;
    else if (idxP !== -1) this.controller.playerBattlefield[idxP] = null;
    else if (idxE !== -1) this.controller.enemyBattlefield[idxE] = null;
    const deck = target.data.isEnemy ? this.controller.enemyDeck : this.controller.playerDeck;
    const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, ...baseData } = target.data;
    deck.push({ ...baseData });
    this.controller.addLog(`${target.data.name} is placed on top of its owner's deck.`);
    gsap.to(target.mesh.position, { y: 10, duration: 0.5, onComplete: () => {
      this.controller.disposeCard(target);
    }});
  }

  /** Count Horsemen in play for War, Hades, Pestilence (owner's side only). Only flipped cards count. */
  public countHorsemenInPlay(isEnemy: boolean): number {
    const all = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
    return all.filter(c => c.data.type === 'Horseman' && c.data.isEnemy === isEnemy).length;
  }

  /** Count Vampyres in play for Lord's Activate. With Duke in play (flipped), that side's creatures count as Vampyre. Only flipped cards count. */
  public countVampyresInPlay(isEnemy: boolean): number {
    const flippedInPlay = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
    const playerHasDuke = flippedInPlay.some(c => c.data.name === 'Duke' && !c.data.isEnemy);
    const enemyHasDuke = flippedInPlay.some(c => c.data.name === 'Duke' && c.data.isEnemy);
    const considerVampyre = (c: CardEntity) =>
      c.data.faction === 'Vampyre' ||
      (c.data.isEnemy === isEnemy && (isEnemy ? enemyHasDuke : playerHasDuke));
    return flippedInPlay.filter(considerVampyre).length;
  }

  public async allocateCounters(card: CardEntity, isAI: boolean) {
    const data = card.data;
    let powerPool = data.markerPower || 0;
    let weaknessPool = data.markerWeakness || 0;

    if (isAI) {
      const myUnits = this.controller.enemyBattlefield.filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      const enemyUnits = this.controller.playerBattlefield.filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      
      for (let i = 0; i < powerPool; i++) {
        if (myUnits.length > 0) {
          if (!this.isImmuneToAbilities(myUnits[0], card)) {
            myUnits[0].data.powerMarkers++;
            myUnits[0].updateVisualMarkers();
          } else {
            this.controller.addLog(`${myUnits[0].data.name} is immune to markers from ${card.data.name}`);
          }
        }
      }
      for (let i = 0; i < weaknessPool; i++) {
        if (enemyUnits.length > 0) {
          if (!this.isImmuneToAbilities(enemyUnits[0], card)) {
            enemyUnits[0].data.weaknessMarkers++;
            enemyUnits[0].updateVisualMarkers();
          } else {
            this.controller.addLog(`${enemyUnits[0].data.name} is immune to markers from ${card.data.name}`);
          }
        }
      }
      return Promise.resolve();
    } else {
      this.controller.updateState({ 
        currentPhase: Phase.COUNTER_ALLOCATION, 
        powerPool, 
        weaknessPool,
        abilitySourceCardName: card.data.name
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
      });
    }
  }

  public async handleTargetedAbility(source: CardEntity, isAI: boolean) {
    const data = source.data;
    if (data.targetType === 'champion') {
      const targets = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
        .filter(c => c !== null && (c as CardEntity).data.faceUp && (c as CardEntity).data.isChampion) as CardEntity[];
      if (isAI) {
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          this.applyAbilityEffect(target, { source, effect: data.effect });
        } else {
          this.controller.addLog(`${source.data.name} finds no Champion in play to place on deck.`);
        }
        return Promise.resolve();
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "Lord: Choose a Champion to place on top of its owner's deck."
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: data.effect, targetType: data.targetType };
      });
    }
    if (data.targetType === 'limbo_creature') {
      const targets = [...this.controller.playerLimbo, ...this.controller.enemyLimbo];
      if (isAI) {
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          this.applyAbilityEffect(target, { source, effect: data.effect });
        } else {
          this.controller.addLog(`${source.data.name} finds no creature in Limbo to absorb.`);
        }
        return Promise.resolve();
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: 'Sentinel: Choose a creature in Limbo (power value added to Sentinel).',
        isSelectingLimboTarget: true
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: data.effect, targetType: data.targetType };
      });
    }

    // Envy: targetType creature_power_gte — valid targets = creatures with effective power >= source's (only flipped)
    if (data.targetType === 'creature_power_gte') {
      const sourcePower = source.data.power + source.data.powerMarkers - source.data.weaknessMarkers;
      const allCreatures = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && c !== source && (c as CardEntity).data.faceUp) as CardEntity[];
      const validTargets = allCreatures.filter(c => {
        const p = c.data.power + c.data.powerMarkers - c.data.weaknessMarkers;
        return p >= sourcePower && !this.isImmuneToAbilities(c, source);
      });
      if (isAI) {
        if (validTargets.length > 0) {
          const target = validTargets[Math.floor(Math.random() * validTargets.length)];
          this.applyAbilityEffect(target, { source, effect: data.effect, markerWeakness: data.markerWeakness ?? 3 });
        } else {
          this.controller.addLog(`${source.data.name} finds no creature with Power Value ≥ its own to affect.`);
        }
        return Promise.resolve();
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "Envy: Choose a creature with Power Value ≥ Envy's to place -3 Weakness on."
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: data.effect, targetType: data.targetType, validTargets, markerWeakness: data.markerWeakness ?? 3 };
      });
    }

    if (isAI) {
      let targets: CardEntity[];
      if (data.targetType === 'creature') {
        const all = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
        targets = all.filter(c => !this.isImmuneToAbilities(c, source));
      } else {
        targets = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      }
      if (targets.length > 0) {
        this.applyAbilityEffect(targets[0], { source, effect: data.effect, markerWeakness: source.data.markerWeakness });
      } else if (data.effect === 'place_weakness') {
        this.controller.addLog(`${source.data.name} finds no valid creature to place Weakness on.`);
      }
      return Promise.resolve();
    }

    const instructionText = data.effect === 'place_power'
      ? `${source.data.name}: Choose a creature to place +${source.data.markerPower ?? 3} Power Marker(s) on.`
      : data.effect === 'place_weakness'
      ? (data.targetType === 'creature_power_gte' ? "Envy: Choose a creature with Power Value ≥ Envy's to place -3 Weakness on." : `${source.data.name}: Choose a creature to place -${source.data.markerWeakness ?? 3} Weakness on.`)
      : `Select a target to ${data.effect?.toUpperCase()}.`;
    this.controller.updateState({
      currentPhase: Phase.ABILITY_TARGETING,
      instructionText
    });
    this.controller.zoomOut();
    return new Promise<void>((resolve) => {
      (this.controller as any).resolutionCallback = resolve;
      (this.controller as any).pendingAbilityData = { source, effect: data.effect, targetType: data.targetType, markerWeakness: source.data.markerWeakness };
    });
  }

  /** Sloth Action: destroy any creature in play with Weakness Markers. Only flipped cards are valid targets. */
  public async handleSlothDestroyAction(source: CardEntity, isAI: boolean) {
    const validTargets = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
      .filter(c => c !== null && (c as CardEntity).data.faceUp && (c as CardEntity).data.weaknessMarkers > 0) as CardEntity[];
    if (validTargets.length === 0) {
      this.controller.addLog(`${source.data.name} finds no creature with Weakness Markers to destroy.`);
      return;
    }
    if (isAI) {
      const target = validTargets[Math.floor(Math.random() * validTargets.length)];
      this.applyAbilityEffect(target, { source, effect: 'destroy_creature_with_weakness' });
      return;
    }
    this.controller.updateState({
      currentPhase: Phase.ABILITY_TARGETING,
      instructionText: "Sloth: Choose a creature with Weakness Markers to destroy."
    });
    this.controller.zoomOut();
    await new Promise<void>((resolve) => {
      (this.controller as any).resolutionCallback = resolve;
      (this.controller as any).pendingAbilityData = { source, effect: 'destroy_creature_with_weakness', validTargets };
    });
  }

  public async handleLimboAbility(card: CardEntity) {
    if (card.data.name === "Martyr") {
      this.controller.updateState({
        currentPhase: Phase.SEAL_TARGETING,
        instructionText: "Martyr: Select a Neutral undefended Seal to Purify."
      });
      this.controller.zoomOut();
      const targetIdx = await new Promise<number>((resolve) => {
        (this.controller as any).sealSelectionCallback = (idx: number) => {
          const seal = this.controller.seals[idx];
          if (!seal.champion && seal.alignment === Alignment.NEUTRAL) {
            resolve(idx);
          } else {
            this.controller.addLog("Invalid target for Martyr.");
            resolve(-1);
          }
        };
      });

      if (targetIdx !== -1) {
        await this.controller.claimSeal(targetIdx, Alignment.LIGHT);
        this.controller.addLog(`Martyr Purifies Seal ${targetIdx + 1}`);
        this.moveToGraveyard(card);
      } else {
        this.controller.updateState({ currentPhase: Phase.PREP });
      }
      return;
    }

    // Saint Michael: Final Act — in Limbo, move to Graveyard to destroy a card that battled this turn
    if (card.data.name === "Saint Michael") {
      const inPlay = (c: CardEntity) =>
        this.controller.playerBattlefield.includes(c) ||
        this.controller.enemyBattlefield.includes(c) ||
        this.controller.seals.some(s => s.champion === c);
      const validTargets = [...new Set(this.controller.cardsThatBattledThisRound)].filter(inPlay);
      if (validTargets.length === 0) {
        this.controller.addLog("Saint Michael: No cards that battled this turn are still in play.");
        this.controller.updateState({ currentPhase: Phase.PREP });
        return;
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "Saint Michael (Limbo): Select a card that battled this turn to destroy. Saint Michael moves to Graveyard."
      });
      this.controller.zoomOut();
      await new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source: card, effect: 'saint_michael_destroy', targetType: 'battled', validTargets };
      });
      return;
    }

    // Lilith: Final Act — same as Saint Michael: in Limbo, move to Graveyard to destroy a card that battled this turn
    if (card.data.name === "Lilith") {
      const inPlay = (c: CardEntity) =>
        this.controller.playerBattlefield.includes(c) ||
        this.controller.enemyBattlefield.includes(c) ||
        this.controller.seals.some(s => s.champion === c);
      const validTargets = [...new Set(this.controller.cardsThatBattledThisRound)].filter(inPlay);
      if (validTargets.length === 0) {
        this.controller.addLog("Lilith: No cards that battled this turn are still in play.");
        this.controller.updateState({ currentPhase: Phase.PREP });
        return;
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "Lilith (Limbo): Select a card that battled this turn to destroy. Lilith moves to Graveyard."
      });
      this.controller.zoomOut();
      await new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source: card, effect: 'saint_michael_destroy', targetType: 'battled', validTargets };
      });
      return;
    }
  }

  public async checkNullify(source: CardEntity): Promise<boolean> {
    const isEnemy = source.data.isEnemy;
    const opponentLimbo = isEnemy ? this.controller.playerLimbo : this.controller.enemyLimbo;
    const fallenOne = opponentLimbo.find(c => c.data.name === "Fallen One");

    if (fallenOne) {
      if (!isEnemy) {
        // AI check: Enemy has Fallen One in Limbo, should it nullify Player's ability?
        // Simple AI: always nullify powerful abilities or just random for now
        if (Math.random() < 0.5) {
          this.controller.addLog(`Enemy uses Fallen One from Limbo to Nullify ${source.data.name}'s ability!`);
          this.moveToGraveyard(fallenOne);
          return true;
        }
      } else {
        // Player check: Player has Fallen One in Limbo, ask if they want to nullify Enemy's ability
        // For now, I'll use a simple confirmation or just auto-trigger if I can't do UI easily.
        // The user asked for "a new interface element to be able to trigger abilities from the Limbo Area".
        // I'll implement a state for this.
        this.controller.updateState({
          instructionText: `Use Fallen One from Limbo to Nullify ${source.data.name}?`,
          currentPhase: Phase.ABILITY_TARGETING,
          decisionContext: 'FALLEN_ONE',
          decisionMessage: `Opponent revealed ${source.data.name}. Use Fallen One from your Limbo to nullify its ability? (Fallen One is moved to your Graveyard.)`
        });
        
        const confirmed = await new Promise<boolean>((resolve) => {
          (this.controller as any).nullifyCallback = resolve;
        });

        this.controller.updateState({ decisionContext: undefined, decisionMessage: undefined });

        if (confirmed) {
          this.controller.addLog(`Player uses Fallen One from Limbo to Nullify ${source.data.name}'s ability!`);
          this.moveToGraveyard(fallenOne);
          return true;
        }
      }
    }
    return false;
  }

  public moveToGraveyard(card: CardEntity) {
    const isEnemy = card.data.isEnemy;
    const limbo = isEnemy ? this.controller.enemyLimbo : this.controller.playerLimbo;
    const grave = isEnemy ? this.controller.enemyGraveyard : this.controller.playerGraveyard;
    const graveMesh = isEnemy ? this.controller.enemyGraveyardMesh : this.controller.playerGraveyardMesh;

    const idx = limbo.indexOf(card);
    if (idx !== -1) limbo.splice(idx, 1);
    grave.push(card);

    gsap.to(card.mesh.position, {
      x: graveMesh.position.x + (Math.random() - 0.5),
      y: 0.2 + (grave.length * 0.05),
      z: graveMesh.position.z + (Math.random() - 0.5),
      duration: 0.8
    });
    this.controller.updateState({}); // Refresh counts
  }

  public async handleActivateAbility(source: CardEntity, isAI: boolean) {
    // Greed: Activate = Transfer all Power Markers in play to this creature (only from flipped cards)
    if (source.data.name === "Greed") {
      const allCards = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && c !== source && c.data.faceUp) as CardEntity[];
      let totalP = 0;
      allCards.forEach(c => {
        totalP += c.data.powerMarkers;
        c.data.powerMarkers = 0;
        c.updateVisualMarkers();
      });
      source.data.powerMarkers += totalP;
      source.updateVisualMarkers();
      this.controller.addLog(`${source.data.name} transfers all Power Markers in play to itself.`);
      return;
    }

    if (source.data.name === "Nephilim") {
      if (isAI) {
        const targetIdx = Math.floor(Math.random() * 7);
        this.controller.updateState({ lockedSealIndex: targetIdx });
        this.controller.addLog(`Nephilim locks Seal ${targetIdx + 1} from influence changes.`);
      } else {
        this.controller.updateState({
          currentPhase: Phase.SEAL_TARGETING,
          instructionText: "Nephilim: Select a Seal to lock from influence changes."
        });
        this.controller.zoomOut();
        const targetIdx = await new Promise<number>((resolve) => {
          (this.controller as any).sealSelectionCallback = resolve;
        });
        this.controller.updateState({ lockedSealIndex: targetIdx });
        this.controller.addLog(`Nephilim locks Seal ${targetIdx + 1} from influence changes.`);
      }
      return;
    }

    // The Almighty: Activate = Destroy all instances of one marker type (all Power or all Weakness). Only flipped cards.
    if (source.data.name === "The Almighty") {
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      if (isAI) {
        const totalP = allBoard.reduce((s, c) => s + c.data.powerMarkers, 0);
        const totalW = allBoard.reduce((s, c) => s + c.data.weaknessMarkers, 0);
        const choice: 'power' | 'weakness' = totalP >= totalW && totalP > 0 ? 'power' : totalW > 0 ? 'weakness' : 'power';
        const key = choice === 'power' ? 'powerMarkers' : 'weaknessMarkers';
        let count = 0;
        allBoard.forEach(c => {
          count += c.data[key];
          c.data[key] = 0;
          c.updateVisualMarkers();
        });
        this.controller.addLog(`The Almighty destroys all ${choice === 'power' ? 'Power' : 'Weakness'} Markers in play (${count} removed).`);
        return;
      }
      this.controller.updateState({
        decisionContext: 'ALMIGHTY_MARKER_TYPE',
        instructionText: "The Almighty: Choose a marker type to destroy all instances of (in play).",
        decisionMessage: "Destroy all Power Markers in play, or all Weakness Markers in play. Choose one type."
      });
      this.controller.zoomOut();
      const choice = await new Promise<'power' | 'weakness'>((resolve) => {
        (this.controller as any).markerTypeCallback = resolve;
      });
      this.controller.updateState({ decisionContext: undefined, decisionMessage: undefined });
      const key = choice === 'power' ? 'powerMarkers' : 'weaknessMarkers';
      const typeName = choice === 'power' ? 'Power' : 'Weakness';
      let count = 0;
      allBoard.forEach(c => {
        count += c.data[key];
        c.data[key] = 0;
        c.updateVisualMarkers();
      });
      this.controller.addLog(`The Almighty destroys all ${typeName} Markers in play (${count} removed).`);
      return;
    }

    // The Allotter: Activate = Destroy one Marker of any type (single target). Only flipped cards.
    if (source.data.name === "The Allotter") {
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      if (isAI) {
        const withMarkers = allBoard.filter(c => c.data.powerMarkers > 0 || c.data.weaknessMarkers > 0);
        if (withMarkers.length > 0) {
          const target = withMarkers[Math.floor(Math.random() * withMarkers.length)];
          this.applyAbilityEffect(target, { source, effect: 'destroy_marker' });
        } else {
          this.controller.addLog(`${source.data.name} finds no Markers to destroy.`);
        }
        return;
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "The Allotter: Select a card with a Marker to destroy one Marker."
      });
      this.controller.zoomOut();
      await new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: 'destroy_marker', targetType: 'any' };
      });
      return;
    }

    // Saint Michael: Activate = If you control 5+ Seals with Champions, you win
    if (source.data.name === "Saint Michael") {
      const isEnemy = source.data.isEnemy;
      const sealsWithChampion = this.controller.seals.filter(s => s.champion && s.champion.data.isEnemy === isEnemy).length;
      if (sealsWithChampion >= 5) {
        this.controller.addLog(`${source.data.name}: You control ${sealsWithChampion} Seals with Champions — you win!`);
        (this.controller as any).phaseManager.finalizeGame("Five Seals with Champions");
        return;
      }
      this.controller.addLog(`${source.data.name} activates (${sealsWithChampion}/5 Seals with Champions).`);
      return;
    }

    // Lilith: Activate = If you control 5+ Seals with Champions, you win (same as Saint Michael)
    if (source.data.name === "Lilith") {
      const isEnemy = source.data.isEnemy;
      const sealsWithChampion = this.controller.seals.filter(s => s.champion && s.champion.data.isEnemy === isEnemy).length;
      if (sealsWithChampion >= 5) {
        this.controller.addLog(`${source.data.name}: You control ${sealsWithChampion} Seals with Champions — you win!`);
        (this.controller as any).phaseManager.finalizeGame("Five Seals with Champions");
        return;
      }
      this.controller.addLog(`${source.data.name} activates (${sealsWithChampion}/5 Seals with Champions).`);
      return;
    }

    // Death: Activate = If you have 4 Horseman in play with at least one Champion on a Seal, you win
    if (source.data.name === "Death") {
      const isEnemy = source.data.isEnemy;
      const horsemanCount = this.countHorsemenInPlay(isEnemy);
      const hasChampionOnSeal = this.controller.seals.some(s => s.champion && s.champion.data.isEnemy === isEnemy);
      if (horsemanCount >= 4 && hasChampionOnSeal) {
        this.controller.addLog(`${source.data.name}: 4+ Horsemen in play and a Champion on a Seal — you win!`);
        (this.controller as any).phaseManager.finalizeGame("Horseman (4 Horsemen + Champion on Seal)");
        return;
      }
      this.controller.addLog(`${source.data.name} activates (${horsemanCount} Horsemen, Champion on Seal: ${hasChampionOnSeal}).`);
      return;
    }

    // The Destroyer: Activate = Destroy any one Marker type (single marker, same as The Allotter). Only flipped cards.
    if (source.data.name === "The Destroyer") {
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
      if (isAI) {
        const withMarkers = allBoard.filter(c => c.data.powerMarkers > 0 || c.data.weaknessMarkers > 0);
        if (withMarkers.length > 0) {
          const target = withMarkers[Math.floor(Math.random() * withMarkers.length)];
          this.applyAbilityEffect(target, { source, effect: 'destroy_marker' });
        } else {
          this.controller.addLog(`${source.data.name} finds no Markers to destroy.`);
        }
        return;
      }
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: "The Destroyer: Select a card with a Marker to destroy one Marker."
      });
      this.controller.zoomOut();
      await new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: 'destroy_marker', targetType: 'any' };
      });
      return;
    }

    // The Spinner: Activate = Win if 4 Acolytes (Light) in play and at least one Champion on a Seal. Only flipped count.
    if (source.data.name === "The Spinner") {
      const isEnemy = source.data.isEnemy;
      const acolytesInPlay = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
        .filter(c => c !== null && (c as CardEntity).data.faceUp && c.data.faction === "Light") as CardEntity[];
      const count = acolytesInPlay.length;
      const hasChampionOnSeal = this.controller.seals.some(s => s.champion && s.champion.data.isEnemy === isEnemy);
      if (count >= 4 && hasChampionOnSeal) {
        this.controller.addLog(`The Spinner: 4+ Acolytes in play and a Champion on a Seal — you win!`);
        (this.controller as any).phaseManager.finalizeGame("The Spinner (4 Acolytes + Champion on Seal)");
        return;
      }
      this.controller.addLog(`The Spinner activates (${count} Acolytes, Champion on Seal: ${hasChampionOnSeal}).`);
      return;
    }

    // Lord: Activate = +1 Power Marker on Lord for each Vampyre in play (Duke passive: your creatures count as Vampyre)
    if (source.data.name === "Lord") {
      const isEnemy = source.data.isEnemy;
      const count = this.countVampyresInPlay(isEnemy);
      source.data.powerMarkers += count;
      source.updateVisualMarkers();
      this.controller.addLog(`${source.data.name} gains ${count} Power Markers (one per Vampyre in play).`);
      return;
    }
  }

  public async handleSealTargetAbility(source: CardEntity, isAI: boolean) {
    // Regent: no fixed sealEffect — controller chooses their alignment for the seal
    const pAlign = this.controller.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    let effect = source.data.sealEffect as Alignment | undefined;
    if (source.data.name === "Regent") {
      effect = source.data.isEnemy ? eAlign : pAlign;
    }
    const corruptOnly = source.data.name === "The Almighty";
    if (isAI) {
      const targetAlign = effect === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
      let validSeals = this.controller.seals.filter(s => !s.champion && (s.alignment === targetAlign || s.alignment === Alignment.NEUTRAL));
      if (corruptOnly && effect === Alignment.LIGHT) validSeals = validSeals.filter(s => s.alignment === Alignment.DARK);
      if (validSeals.length > 0 && effect) await this.controller.claimSeal(validSeals[0].index, effect);
      return Promise.resolve();
    } else {
      this.controller.updateState({
        currentPhase: Phase.SEAL_TARGETING,
        instructionText: source.data.name === "Regent"
          ? `Regent: Select a Seal without a Champion to change to ${effect === Alignment.LIGHT ? 'Light' : 'Dark'}.`
          : corruptOnly && effect === Alignment.LIGHT
          ? "The Almighty: Select a Corrupted (Dark) Seal without a Champion to Purify."
          : `Select an undefended seal to ${effect === Alignment.LIGHT ? 'PURIFY' : 'CORRUPT'}.`
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: effect ?? pAlign, corruptOnly: corruptOnly && effect === Alignment.LIGHT };
      });
    }
  }
}
