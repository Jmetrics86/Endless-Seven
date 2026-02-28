import { CardEntity } from '../entities/CardEntity';
import { Alignment, Phase } from '../types';
import { IGameController } from './interfaces';
import gsap from 'gsap';

export class AbilityManager {
  constructor(private controller: IGameController) {}

  public isImmuneToAbilities(target: CardEntity, source: CardEntity): boolean {
    if (source.data.type !== 'Creature') return false;
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
      const gain = winner.data.name === "War" ? 3 : 2;
      winner.data.powerMarkers += gain;
      winner.updateVisualMarkers();
      this.controller.addLog(`${winner.data.name} gains ${gain} Power Markers from victory`);
      return;
    }
    if (winner.data.name === "The Inevitable") {
      // After destroying a creature, you may destroy another card or Marker in play
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[];
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
      const allCards = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && c !== source) as CardEntity[];
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

    if (target.data.isInvincible && effect !== 'destroy_marker') return;

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
      if (seal) {
        this.controller.destroyCard(target, target.data.isEnemy, seal.index, true);
        seal.champion = null;
      } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false);
      else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false);
      this.controller.addLog(`Saint Michael destroys ${target.data.name} and is moved to the Graveyard.`);
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
        if (seal) {
          this.controller.destroyCard(target, target.data.isEnemy, seal.index, true);
          seal.champion = null;
        } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false);
        else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false);
        this.controller.addLog(`${source.data.name} destroys ${target.data.name}.`);
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
      if (seal) {
        this.controller.destroyCard(target, target.data.isEnemy, seal.index, true);
        seal.champion = null;
      } else if (idxP !== -1) this.controller.destroyCard(target, false, idxP, false);
      else if (idxE !== -1) this.controller.destroyCard(target, true, idxE, false);
    } else if (effect === 'return') {
      const idxP = this.controller.playerBattlefield.indexOf(target);
      const idxE = this.controller.enemyBattlefield.indexOf(target);
      const seal = this.controller.seals.find(s => s.champion === target);
      
      if (seal) seal.champion = null;
      else if (idxP !== -1) this.controller.playerBattlefield[idxP] = null;
      else if (idxE !== -1) this.controller.enemyBattlefield[idxE] = null;

      this.controller.addLog(`${source.data.name} spins ${target.data.name} back to deck`);
      const deck = target.data.isEnemy ? this.controller.enemyDeck : this.controller.playerDeck;
      const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, ...baseData } = target.data;
      deck.push({ ...baseData });
      gsap.to(target.mesh.position, { y: 10, duration: 0.5, onComplete: () => {
        this.controller.disposeCard(target);
      }});
    }
  }

  public async allocateCounters(card: CardEntity, isAI: boolean) {
    const data = card.data;
    let powerPool = data.markerPower || 0;
    let weaknessPool = data.markerWeakness || 0;

    if (isAI) {
      const myUnits = this.controller.enemyBattlefield.filter(c => c !== null) as CardEntity[];
      const enemyUnits = this.controller.playerBattlefield.filter(c => c !== null) as CardEntity[];
      
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
        instructionText: 'Sentinel: Choose a creature in Limbo (power value added to Sentinel).'
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: data.effect, targetType: data.targetType };
      });
    }
    if (isAI) {
      const targets = (data.targetType === 'creature'
        ? this.controller.playerBattlefield
        : [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
      ).filter(c => c !== null) as CardEntity[];

      if (targets.length > 0) {
        this.applyAbilityEffect(targets[0], { source, effect: data.effect });
      }
      return Promise.resolve();
    } else {
      this.controller.updateState({
        currentPhase: Phase.ABILITY_TARGETING,
        instructionText: `Select a target to ${data.effect?.toUpperCase()}.`
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect: data.effect, targetType: data.targetType };
      });
    }
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

    // The Almighty: Activate = Destroy all instances of one marker type (all Power or all Weakness)
    if (source.data.name === "The Almighty") {
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[];
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

    // The Allotter: Activate = Destroy one Marker of any type (single target)
    if (source.data.name === "The Allotter") {
      const allBoard = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null) as CardEntity[];
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
        (this.controller as any).phaseManager.finalizeGame();
        return;
      }
      this.controller.addLog(`${source.data.name} activates (${sealsWithChampion}/5 Seals with Champions).`);
      return;
    }

    // The Spinner: Activate = Win if 4 Acolytes (Light) in play and at least one Champion on a Seal
    if (source.data.name === "The Spinner") {
      const isEnemy = source.data.isEnemy;
      const acolytesInPlay = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
        .filter(c => c !== null && c.data.faction === "Light") as CardEntity[];
      const count = acolytesInPlay.length;
      const hasChampionOnSeal = this.controller.seals.some(s => s.champion && s.champion.data.isEnemy === isEnemy);
      if (count >= 4 && hasChampionOnSeal) {
        this.controller.addLog(`The Spinner: 4+ Acolytes in play and a Champion on a Seal — you win!`);
        (this.controller as any).phaseManager.finalizeGame();
        return;
      }
      this.controller.addLog(`The Spinner activates (${count} Acolytes, Champion on Seal: ${hasChampionOnSeal}).`);
      return;
    }
  }

  public async handleSealTargetAbility(source: CardEntity, isAI: boolean) {
    const effect = source.data.sealEffect as Alignment;
    // The Almighty: Purify any Corrupted Seal without a Champion (Dark only)
    const corruptOnly = source.data.name === "The Almighty";
    if (isAI) {
      const targetAlign = effect === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
      let validSeals = this.controller.seals.filter(s => !s.champion && (s.alignment === targetAlign || s.alignment === Alignment.NEUTRAL));
      if (corruptOnly && effect === Alignment.LIGHT) validSeals = validSeals.filter(s => s.alignment === Alignment.DARK);
      if (validSeals.length > 0) await this.controller.claimSeal(validSeals[0].index, effect);
      return Promise.resolve();
    } else {
      this.controller.updateState({
        currentPhase: Phase.SEAL_TARGETING,
        instructionText: corruptOnly && effect === Alignment.LIGHT
          ? "The Almighty: Select a Corrupted (Dark) Seal without a Champion to Purify."
          : `Select an undefended seal to ${effect === Alignment.LIGHT ? 'PURIFY' : 'CORRUPT'}.`
      });
      this.controller.zoomOut();
      return new Promise<void>((resolve) => {
        (this.controller as any).resolutionCallback = resolve;
        (this.controller as any).pendingAbilityData = { source, effect, corruptOnly: corruptOnly && effect === Alignment.LIGHT };
      });
    }
  }
}
