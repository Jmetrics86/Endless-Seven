import gsap from 'gsap';
import { Phase, Alignment, CardData } from '../types';
import { CardEntity, getOrLoadBackTexture } from '../entities/CardEntity';
import { IGameController } from './interfaces';
import { GAME_CONSTANTS } from '../constants';

export class PhaseManager {
  constructor(private controller: IGameController) {}

  public async startPrepPhase() {
    if (this.controller.isProcessing) return;
    this.controller.isProcessing = true;
    this.controller.addLog(`--- Round ${this.controller.state.currentRound} Prep Phase ---`);
    this.controller.updateState({ currentPhase: Phase.PREP, phaseStep: 'Step 1: Draw Hand', lockedSealIndex: -1 });

    // Clear any temporary battle invincibility applied in the previous round
    this.clearTemporaryInvincibility();

    // Preload card back texture before creating any hand cards so the first (leftmost) card is never rendered without it
    await getOrLoadBackTexture();

    for (let i = 0; i < 8; i++) {
      if (this.controller.playerDeck.length === 0) break;
      const cardData = this.controller.playerDeck.pop()!;
      const card = new CardEntity(cardData, false, this.controller.state.playerAlignment);
      this.controller.entityManager.add(card);
      card.mesh.position.set(-15, 2, 6); // Deck position
      this.controller.sceneManager.scene.add(card.mesh);
      this.controller.playerHand.push(card);
      card.applyBackTextureIfNeeded(); // All cards share same back graphic; ensure it is applied as soon as ready

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

  /** Clear temporary battle invincibility from all cards in play (battlefield + champions). */
  public clearTemporaryInvincibility() {
    [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)]
      .filter(c => c !== null)
      .forEach(c => {
        if (c!.data.isInvincible) {
          c!.data.isInvincible = false;
          this.controller.addLog(`${c!.data.name}'s Invulnerability fades.`);
        }
      });
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
      card.applyBackTextureIfNeeded(); // All cards share same back graphic; ensure it is applied as soon as ready

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
    (this.controller as any).pendingBaronSwapSlot = null;
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
    this.controller.cardsThatBattledThisRound = [];
    this.controller.abilityManager.syncBoardPresencePowerMarkers();
    this.controller.updateState({ currentPhase: Phase.RESOLUTION });
    this.controller.addLog("--- Resolution Phase Started ---");
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      if (this.controller.state.currentPhase === Phase.GAME_OVER) break;
      await this.resolveSeal(i);
    }

    // End-of-round cleanup effects (e.g., Wild Wolf, Delta)
    await this.cleanupEndOfRoundEffects();
    
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

    if ((pHaste || eHaste) && !pCard?.data.cannotBattleOrBeBattled && !eCard?.data.cannotBattleOrBeBattled) {
      this.controller.updateState({ phaseStep: "Step 0: Haste Strike" });
      // Champion must be battled first (same priority as Step C: Combat); only then slot vs slot.
      // Visual rule: if we are about to battle while cards are still face-down, reveal them first
      // (but do NOT set `data.faceUp=true`, so flip abilities still trigger later in Step A/B).
      const revealForCombat = async (...cards: (CardEntity | null | undefined)[]) => {
        const toReveal = cards.filter((c): c is CardEntity => !!c && !c.data.faceUp);
        if (toReveal.length === 0) return;
        toReveal.forEach((c) => gsap.to(c.mesh.rotation, { x: 0, duration: 0.35 }));
        await new Promise((r) => setTimeout(r, 420));
      };

      if (pCard && seal.champion && seal.champion.data.isEnemy) {
        await revealForCombat(pCard, seal.champion);
        await this.controller.handleBattle(pCard, seal.champion, idx, true);
      } else if (eCard && seal.champion && !seal.champion.data.isEnemy) {
        await revealForCombat(eCard, seal.champion);
        await this.controller.handleBattle(eCard, seal.champion, idx, true);
      } else if (pCard && eCard) {
        await revealForCombat(pCard, eCard);
        await this.controller.handleBattle(pCard, eCard, idx, false);
      }
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
      if (current.data.ability.toLowerCase().includes("invulnerability") || current.data.name === "Nephilim" || current.data.name === "Greed") {
        current.data.isInvincible = true;
        this.controller.addLog(`${current.data.name} gains battle invulnerability this turn`);
      }

      // Wrath: Flip — -1 Weakness on each enemy creature (no allocation)
      if (current.data.name === "Wrath") {
        const enemyCreatures = (side === 'player'
          ? [...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion).filter(c => c !== null && c!.data.isEnemy)]
          : [...this.controller.playerBattlefield, ...this.controller.seals.map(s => s.champion).filter(c => c !== null && !c!.data.isEnemy)]
        ).filter(c => c !== null) as CardEntity[];
        enemyCreatures.forEach(c => {
          if (!this.controller.abilityManager.isImmuneToAbilities(c, current)) {
            c.data.weaknessMarkers += 1;
            c.updateVisualMarkers();
          }
        });
        this.controller.addLog(`${current.data.name} places a -1 Weakness Marker on each enemy creature.`);
      }

      // Pride: Flip — -3 Weakness on creature across; Action — +2 Power on each adjacent
      if (current.data.name === "Pride") {
        if (opponent && !this.controller.abilityManager.isImmuneToAbilities(opponent, current)) {
          opponent.data.weaknessMarkers += 3;
          opponent.updateVisualMarkers();
          this.controller.addLog(`${current.data.name} places -3 Weakness on ${opponent.data.name}.`);
        }
        const neighbors = [];
        if (idx > 0) neighbors.push(side === 'player' ? this.controller.playerBattlefield[idx - 1] : this.controller.enemyBattlefield[idx - 1]);
        if (idx < 6) neighbors.push(side === 'player' ? this.controller.playerBattlefield[idx + 1] : this.controller.enemyBattlefield[idx + 1]);
        neighbors.forEach(n => {
          if (n && !this.controller.abilityManager.isImmuneToAbilities(n, current)) {
            n.data.powerMarkers += 2;
            n.updateVisualMarkers();
          }
        });
        this.controller.addLog(`${current.data.name} places +2 Power on each adjacent creature.`);
      }

      // Nephilim Activate
      if (isActivate && current.data.name === "Nephilim") {
        current.data.isActivatingAbility = true;
        await (this.controller.abilityManager as any).handleActivateAbility(current, current.data.isEnemy);
        current.data.isActivatingAbility = false;
      }
      // The Almighty, The Allotter, Saint Michael, The Spinner, Lord, Greed: Activate
      if (isActivate && (current.data.name === "The Almighty" || current.data.name === "The Allotter" || current.data.name === "Saint Michael" || current.data.name === "The Spinner" || current.data.name === "Lord" || current.data.name === "Greed" || current.data.name === "The Destroyer" || current.data.name === "Lilith" || current.data.name === "Death")) {
        current.data.isActivatingAbility = true;
        await (this.controller.abilityManager as any).handleActivateAbility(current, current.data.isEnemy);
        current.data.isActivatingAbility = false;
      }

      // The Spinner / Omega / Hades: board-count Power Markers are applied via AbilityManager.syncBoardPresencePowerMarkers
      // after Step B (see below) so Activate passes do not re-stack markers on champions with hasActivate.

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

      // Thrones
      if (current.data.name === "Thrones") {
        const pAlign = this.controller.state.playerAlignment;
        const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
        const targetAlign = side === 'player' ? pAlign : eAlign;

        if (side === 'enemy') {
          const validSeals = this.controller.seals.filter(s => !s.champion);
          if (validSeals.length > 0) {
            const preferred = validSeals.find(s => s.alignment !== targetAlign) || validSeals[0];
            this.controller.addLog(`${current.data.name} changes the influence of Seal ${preferred.index + 1}`);
            await this.controller.claimSeal(preferred.index, targetAlign, {
              type: 'ability',
              cardName: current.data.name
            });
          } else {
            this.controller.addLog(`${current.data.name} finds no valid Seals to affect`);
          }
        } else {
          const hasValid = this.controller.seals.some(s => !s.champion);
          if (hasValid) {
            this.controller.updateState({ 
              currentPhase: Phase.SEAL_TARGETING,
              instructionText: "Thrones: Select a Seal without a Champion to change its Influence."
            });
            this.controller.zoomOut();
            const targetIdx = await new Promise<number>((resolve) => {
              (this.controller as any).sealSelectionCallback = resolve;
            });
            if (targetIdx >= 0) {
              const seal = this.controller.seals[targetIdx];
              if (!seal.champion) {
                this.controller.addLog(`${current.data.name} changes the influence of Seal ${targetIdx + 1}`);
                await this.controller.claimSeal(targetIdx, targetAlign, {
                  type: 'ability',
                  cardName: current.data.name
                });
              } else {
                this.controller.addLog(`Thrones cannot change a Seal that already has a Champion.`);
              }
            }
          } else {
            this.controller.addLog(`${current.data.name} finds no valid Seals to affect`);
          }
        }
      }

      // Beta: Flip invulnerability + Action: +2 Power Marker on any adjacent creature (each adjacent). Only flipped cards are affected.
      if (current.data.name === "Beta") {
        const neighbors = [];
        if (idx > 0) neighbors.push(side === 'player' ? this.controller.playerBattlefield[idx - 1] : this.controller.enemyBattlefield[idx - 1]);
        if (idx < 6) neighbors.push(side === 'player' ? this.controller.playerBattlefield[idx + 1] : this.controller.enemyBattlefield[idx + 1]);
        neighbors.forEach(n => {
          if (n && n.data.faceUp) {
            n.data.powerMarkers += 2;
            n.updateVisualMarkers();
          }
        });
        current.data.isInvincible = true;
        this.controller.addLog(`${current.data.name} buffs adjacent creatures +2 and gains battle invulnerability this turn`);
      }

      // Delta Activate: mark that Delta can sacrifice at end of round
      if (isActivate && current.data.name === "Delta") {
        current.data.isActivatingAbility = true;
        current.data.pendingDeltaSacrifice = true;
        this.controller.addLog(`${current.data.name} readies its end-of-round sacrifice.`);
        current.data.isActivatingAbility = false;
      }

      // Lust
      if (current.data.name === "Lust") {
        if (opponent && !this.controller.abilityManager.isImmuneToAbilities(opponent, current)) {
          this.controller.addLog(`${current.data.name} forces mutual sacrifice with ${opponent.data.name}`);
          this.controller.destroyCard(current, side === 'enemy', idx, false, { cardName: 'Lust', cause: 'ability' });
          this.controller.destroyCard(opponent, side === 'player', idx, false, { cardName: 'Lust', cause: 'ability' });
          // Effect: After sacrifice, if the Seal has no Champion, you may change the Influence of the seal
          const seal = this.controller.seals[idx];
          if (current.data.hasLustSealEffect && !seal.champion) {
            if (side === 'enemy') {
              const validSeals = this.controller.seals.filter(s => s.index === idx && !s.champion);
              if (validSeals.length > 0) {
                const pAlign = this.controller.state.playerAlignment;
                const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
                const npcAlign = side === 'enemy' ? eAlign : pAlign;
                this.controller.addLog(`Lust's effect: Seal ${idx + 1} influence changed to ${npcAlign === Alignment.LIGHT ? 'Light' : 'Dark'}.`);
                await this.controller.claimSeal(idx, npcAlign, {
                  type: 'ability',
                  cardName: current.data.name
                });
              }
            } else {
              const hasValid = this.controller.seals[idx] && !this.controller.seals[idx].champion;
              if (hasValid) {
                this.controller.updateState({
                  currentPhase: Phase.RESOLUTION,
                  instructionText: "Lust: Seal has no Champion. Choose new Influence for the Seal (Light or Dark).",
                  decisionContext: 'LUST_SEAL_INFLUENCE',
                  sealIndexForChoice: idx
                });
                this.controller.zoomOut();
                const chosenAlign = await new Promise<Alignment>((resolve) => {
                  (this.controller as any).alignmentChoiceCallback = resolve;
                });
                this.controller.updateState({ decisionContext: undefined, sealIndexForChoice: undefined });
                this.controller.addLog(`Lust's effect: Seal ${idx + 1} influence changed.`);
                await this.controller.claimSeal(idx, chosenAlign, {
                  type: 'ability',
                  cardName: current.data.name
                });
              }
            }
          }
        } else if (opponent) {
          this.controller.addLog(`${opponent.data.name} is immune to ${current.data.name}'s sacrifice`);
        }
      }

      // Duke: Flip = place any creature in play on top of that player's deck (handled via hasTargetedAbility)

      // Death: Flip = Choose a creature type, destroy all cards of that type in play. Only flipped cards count or are destroyed.
      // Target types: Avatar, Horseman, God, or creature factions (Vampyre, Lycan, Celestial, Daemon) — not generic "Creature".
      if (current.data.name === "Death" && isFlipping) {
        const allInPlay = [...this.controller.playerBattlefield, ...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion)].filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
        const deathTargetType = (c: CardEntity): string =>
          c.data.type === 'Creature' ? c.data.faction : c.data.type;
        const typesInPlay = [...new Set(allInPlay.map(deathTargetType))];
        if (typesInPlay.length === 0) {
          this.controller.addLog(`${current.data.name} finds no creatures in play to destroy.`);
        } else {
          const chosenType = side === 'enemy'
            ? typesInPlay[Math.floor(Math.random() * typesInPlay.length)]
            : await new Promise<string>((resolve) => {
                this.controller.updateState({
                  currentPhase: Phase.ABILITY_TARGETING,
                  decisionContext: 'DEATH_CREATURE_TYPE',
                  creatureTypeOptions: typesInPlay,
                  instructionText: `Death: Choose a creature type to destroy all of that type in play.`,
                  decisionMessage: `Types in play: ${typesInPlay.join(', ')}`
                });
                this.controller.zoomOut();
                (this.controller as any).creatureTypeCallback = resolve;
              });
          this.controller.updateState({ decisionContext: undefined, creatureTypeOptions: undefined });
          (this.controller as any).creatureTypeCallback = null;
          if (!chosenType) {
            this.controller.addLog(`${current.data.name} did not choose a creature type.`);
          } else {
            const isCreatureFaction = ['Vampyre', 'Lycan', 'Celestial', 'Daemon'].includes(chosenType);
            const toDestroy = allInPlay.filter(c =>
              isCreatureFaction ? (c.data.type === 'Creature' && c.data.faction === chosenType) : c.data.type === chosenType
            );
            const killer = { cardName: current.data.name, cause: 'ability' as const };
            for (const card of toDestroy) {
              const idxP = this.controller.playerBattlefield.indexOf(card);
              const idxE = this.controller.enemyBattlefield.indexOf(card);
              const seal = this.controller.seals.find(s => s.champion === card);
              if (seal) {
                this.controller.destroyCard(card, card.data.isEnemy, seal.index, true, killer);
                seal.champion = null;
              } else if (idxP !== -1) this.controller.destroyCard(card, false, idxP, false, killer);
              else if (idxE !== -1) this.controller.destroyCard(card, true, idxE, false, killer);
            }
            this.controller.addLog(`${current.data.name} destroys all ${chosenType}(s) in play (${toDestroy.length} card(s)).`);
          }
        }
      }

      // Hades: +2 Power per Horseman (tracked via syncBoardPresencePowerMarkers). Secondary: Limbo → deck.
      if (current.data.name === "Hades" && isFlipping) {
        const horsemanCount = this.controller.abilityManager.countHorsemenInPlay(current.data.isEnemy);
        const gain = 2 * horsemanCount;
        this.controller.addLog(`${current.data.name} gains +2 Power per Horseman (${horsemanCount} in play) = ${gain} Power Marker(s) (updated with board state).`);
        // Secondary: Place any card from Limbo you control on top of your deck
        const limbo = current.data.isEnemy ? this.controller.enemyLimbo : this.controller.playerLimbo;
        if (limbo.length > 0) {
          if (side === 'enemy') {
            const pick = limbo[Math.floor(Math.random() * limbo.length)];
            const idx = limbo.indexOf(pick);
            limbo.splice(idx, 1);
            const deck = current.data.isEnemy ? this.controller.enemyDeck : this.controller.playerDeck;
            const { powerMarkers, weaknessMarkers, faceUp, isInvincible, isSuppressed, boardPresencePowerMarkers, ...baseData } = pick.data;
            deck.push({ ...baseData });
            this.controller.disposeCard(pick);
            this.controller.addLog(`${current.data.name} places ${pick.data.name} from Limbo on top of deck.`);
          } else {
            this.controller.updateState({
              currentPhase: Phase.ABILITY_TARGETING,
              instructionText: "Hades (Secondary): Choose a card from your Limbo to place on top of your deck.",
              isSelectingLimboTarget: true
            });
            this.controller.zoomOut();
            await new Promise<void>((resolve) => {
              (this.controller as any).resolutionCallback = resolve;
              (this.controller as any).pendingAbilityData = { source: current, effect: 'hades_limbo_to_deck' };
            });
          }
          this.controller.abilityManager.syncBoardPresencePowerMarkers();
        }
      }

      // Pestilence: Flip = Place -2 Weakness on all Enemy creatures for each Horseman you have in play. Only flipped cards are affected.
      if (current.data.name === "Pestilence" && isFlipping) {
        const horsemanCount = this.controller.abilityManager.countHorsemenInPlay(current.data.isEnemy);
        const amount = 2 * horsemanCount;
        const enemyCreatures = (side === 'player'
          ? [...this.controller.enemyBattlefield, ...this.controller.seals.map(s => s.champion).filter(c => c !== null && c!.data.isEnemy)]
          : [...this.controller.playerBattlefield, ...this.controller.seals.map(s => s.champion).filter(c => c !== null && !c!.data.isEnemy)]
        ).filter(c => c !== null && (c as CardEntity).data.faceUp) as CardEntity[];
        enemyCreatures.forEach(c => {
          if (!this.controller.abilityManager.isImmuneToAbilities(c, current)) {
            c.data.weaknessMarkers += amount;
            c.updateVisualMarkers();
          }
        });
        this.controller.addLog(`${current.data.name} places -2 Weakness per Horseman (${horsemanCount}) on each enemy creature (${amount} total per creature).`);
      }

      if (current.data.needsAllocation) {
        await this.controller.allocateCounters(current, side === 'enemy');
        this.controller.abilityManager.syncBoardPresencePowerMarkers();
      }
      if (current.data.hasTargetedAbility && (isFlipping || !current.data.hasActivate)) {
        await this.controller.handleTargetedAbility(current, side === 'enemy');
      }
      // Sloth Action: after Flip (place weakness), destroy a creature with Weakness Markers
      if (current.data.name === "Sloth") {
        await (this.controller.abilityManager as any).handleSlothDestroyAction(current, side === 'enemy');
      }
      if (current.data.hasGlobalAbility) {
        await this.controller.executeGlobalAbility(current);
      }
      if (current.data.hasSealTargetAbility && isFlipping) {
        await this.controller.handleSealTargetAbility(current, side === 'enemy');
      }
      // Re-evaluate board state for next ability step iteration
      pCard = this.controller.playerBattlefield[idx];
      eCard = this.controller.enemyBattlefield[idx];
    }

    // After all flip/activate abilities (including global marker changes), enforce that
    // any creature whose effective Power Value has been reduced to 0 or less is destroyed,
    // even if it has temporary combat invincibility. This applies across the whole board.
    this.controller.abilityManager.enforceZeroPowerDestruction();

    if (pCard) pCard.data.faceUp = true;
    if (eCard) eCard.data.faceUp = true;
    this.controller.abilityManager.syncBoardPresencePowerMarkers();

    // Step C: Combat
    this.controller.updateState({ phaseStep: "Step C: Combat" });
    let pStymied = false;
    let eStymied = false;

    // Fledgeling: Cannot battle or be battled — skip combat at this seal
    if (pCard?.data.cannotBattleOrBeBattled || eCard?.data.cannotBattleOrBeBattled) {
      this.controller.addLog(`${pCard?.data.cannotBattleOrBeBattled ? pCard?.data.name : eCard?.data.name} cannot battle or be battled.`);
      pStymied = true;
      eStymied = true;
    } else if (pCard && seal.champion && seal.champion.data.isEnemy) {
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
      await this.controller.claimSeal(idx, Alignment.NEUTRAL);
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
    this.controller.cardsThatBattledThisRound.push(attacker);
    this.controller.cardsThatBattledThisRound.push(defender);
    const aPow = attacker.data.power + attacker.data.powerMarkers - attacker.data.weaknessMarkers;
    const dPow = defender.data.power + defender.data.powerMarkers - defender.data.weaknessMarkers;

    const isAProtected = this.controller.abilityManager.isProtected(attacker);
    const isDProtected = this.controller.abilityManager.isProtected(defender);
    let stymied = false;

    const elderAttacker = attacker.data.name === "Elder";
    const elderDefender = defender.data.name === "Elder";
    const sendToDeckInstead = (loser: CardEntity) => {
      this.controller.abilityManager.returnCreatureToOwnerDeck(loser);
    };

    const playCombatSmashWinnerLoser = async (winner: CardEntity, loser: CardEntity): Promise<void> => {
      const w0 = { x: winner.mesh.position.x, y: winner.mesh.position.y, z: winner.mesh.position.z };
      const l0 = { x: loser.mesh.position.x, y: loser.mesh.position.y, z: loser.mesh.position.z };
      const elevate = 0.85;
      const halfDepth = GAME_CONSTANTS.CARD_H / 2;
      const midZ = (w0.z + l0.z) / 2;
      // Stop at edges so cards don't clip; high-z card moves to mid+half, low-z to mid-half
      const impactZWinner = w0.z > l0.z ? midZ + halfDepth : midZ - halfDepth;
      const impactZLoser = l0.z > w0.z ? midZ + halfDepth : midZ - halfDepth;
      const rockBack = 0.28; // recoil distance after impact
      const rockZWinner = w0.z > l0.z ? impactZWinner + rockBack : impactZWinner - rockBack;
      const rockZLoser = l0.z > w0.z ? impactZLoser - rockBack : impactZLoser + rockBack;

      const dx = l0.x - w0.x;
      const dz = l0.z - w0.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      const dirX = dx / dist;
      const dirZ = dz / dist;

      const throwDist = 18;
      const knockX = l0.x + dirX * throwDist;
      const knockZ = l0.z + dirZ * throwDist;
      const knockY = l0.y + 0.35;

      const wScale = (winner.mesh as any).scale;
      const lScale = (loser.mesh as any).scale;
      const lRot = (loser.mesh as any).rotation;

      // Lift both up and bring together with acceleration into impact (power2.in)
      gsap.to(winner.mesh.position, { y: w0.y + elevate, z: impactZWinner, duration: 0.2, ease: 'power2.in' });
      gsap.to(loser.mesh.position, { y: l0.y + elevate, z: impactZLoser, duration: 0.2, ease: 'power2.in' });

      // Optional "smash" scale pulse (skip in unit tests where mock cards don't have scale)
      if (wScale && lScale && typeof wScale.x === 'number' && typeof lScale.x === 'number') {
        gsap.to(wScale, { x: wScale.x * 1.15, y: wScale.y * 1.15, z: wScale.z * 1.15, duration: 0.1, ease: 'power2.out', delay: 0.18 });
        gsap.to(lScale, { x: lScale.x * 1.15, y: lScale.y * 1.15, z: lScale.z * 1.15, duration: 0.1, ease: 'power2.out', delay: 0.18 });
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // Rock back from impact
          gsap.to(winner.mesh.position, { z: rockZWinner, duration: 0.08, ease: 'power2.out' });
          gsap.to(loser.mesh.position, { z: rockZLoser, duration: 0.08, ease: 'power2.out' });
        }, 200);
        setTimeout(() => {
          // Winner drops back to original slot; loser gets knocked away
          gsap.to(winner.mesh.position, { y: w0.y, z: w0.z, duration: 0.22, ease: 'power2.inOut' });
          gsap.to(loser.mesh.position, { x: knockX, y: knockY, z: knockZ, duration: 0.34, ease: 'power3.in' });
          if (lRot && typeof lRot.y === 'number') {
            gsap.to(lRot, { y: Math.random() * 0.6, z: Math.random() * 0.2, duration: 0.34, ease: 'power3.in' });
          }

          // Total approx: 0.08 rock + 0.22 drop + 0.34 knock (triggered at ~0.28)
          setTimeout(() => resolve(), 380);
        }, 280);
      });
    };

    const playCombatSmashMutual = async (a: CardEntity, d: CardEntity): Promise<void> => {
      const a0 = { x: a.mesh.position.x, y: a.mesh.position.y, z: a.mesh.position.z };
      const d0 = { x: d.mesh.position.x, y: d.mesh.position.y, z: d.mesh.position.z };
      const elevate = 0.85;
      const halfDepth = GAME_CONSTANTS.CARD_H / 2;
      const midZ = (a0.z + d0.z) / 2;
      const impactZA = a0.z > d0.z ? midZ + halfDepth : midZ - halfDepth;
      const impactZD = d0.z > a0.z ? midZ + halfDepth : midZ - halfDepth;
      const rockBack = 0.28;
      const rockZA = a0.z > d0.z ? impactZA + rockBack : impactZA - rockBack;
      const rockZD = d0.z > a0.z ? impactZD + rockBack : impactZD - rockBack;

      const dxA = a0.x - d0.x;
      const dzA = a0.z - d0.z;
      const distA = Math.sqrt(dxA * dxA + dzA * dzA) || 1;
      const dirAX = dxA / distA;
      const dirAZ = dzA / distA;

      const dxD = d0.x - a0.x;
      const dzD = d0.z - a0.z;
      const distD = Math.sqrt(dxD * dxD + dzD * dzD) || 1;
      const dirDX = dxD / distD;
      const dirDZ = dzD / distD;

      const throwDist = 16;
      const knockAX = a0.x + dirAX * throwDist;
      const knockAZ = a0.z + dirAZ * throwDist;
      const knockAY = a0.y + 0.35;

      const knockDX = d0.x + dirDX * throwDist;
      const knockDZ = d0.z + dirDZ * throwDist;
      const knockDY = d0.y + 0.35;

      const aScale = (a.mesh as any).scale;
      const dScale = (d.mesh as any).scale;

      gsap.to(a.mesh.position, { y: a0.y + elevate, z: impactZA, duration: 0.2, ease: 'power2.in' });
      gsap.to(d.mesh.position, { y: d0.y + elevate, z: impactZD, duration: 0.2, ease: 'power2.in' });

      if (aScale && dScale && typeof aScale.x === 'number' && typeof dScale.x === 'number') {
        gsap.to(aScale, { x: aScale.x * 1.12, y: aScale.y * 1.12, z: aScale.z * 1.12, duration: 0.1, ease: 'power2.out', delay: 0.18 });
        gsap.to(dScale, { x: dScale.x * 1.12, y: dScale.y * 1.12, z: dScale.z * 1.12, duration: 0.1, ease: 'power2.out', delay: 0.18 });
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          gsap.to(a.mesh.position, { z: rockZA, duration: 0.08, ease: 'power2.out' });
          gsap.to(d.mesh.position, { z: rockZD, duration: 0.08, ease: 'power2.out' });
        }, 200);
        setTimeout(() => {
          gsap.to(a.mesh.position, { x: knockAX, y: knockAY, z: knockAZ, duration: 0.42, ease: 'power3.in' });
          gsap.to(d.mesh.position, { x: knockDX, y: knockDY, z: knockDZ, duration: 0.42, ease: 'power3.in' });
          setTimeout(() => resolve(), 440);
        }, 280);
      });
    };

    const wrathDefenderCannotBeDestroyedByAttacker = defender.data.name === "Wrath" && attacker.data.weaknessMarkers > 0;
    const wrathAttackerCannotBeDestroyedByDefender = attacker.data.name === "Wrath" && defender.data.weaknessMarkers > 0;

    if (aPow > dPow) {
      if (wrathDefenderCannotBeDestroyedByAttacker) {
        this.controller.addLog(`${defender.data.name} cannot be destroyed by ${attacker.data.name} (attacker has Weakness Markers).`);
        stymied = true;
      } else if (!defender.data.isInvincible && !isDProtected) {
        await playCombatSmashWinnerLoser(attacker, defender);
        this.controller.abilityManager.handleFinalAct(defender, attacker);
        if (elderAttacker) sendToDeckInstead(defender);
        else this.controller.destroyCard(defender, defender.data.isEnemy, idx, isAgainstChamp, { cardName: attacker.data.name, cause: 'combat' });
        await this.controller.abilityManager.handlePostCombat(attacker);
      } else {
        this.controller.addLog(`${defender.data.name} is Protected or Invincible. ${attacker.data.name} is stymied.`);
        stymied = true;
      }
    } else if (dPow > aPow) {
      if (wrathAttackerCannotBeDestroyedByDefender) {
        this.controller.addLog(`${attacker.data.name} cannot be destroyed by ${defender.data.name} (attacker has Weakness Markers).`);
        stymied = true;
      } else if (!attacker.data.isInvincible && !isAProtected) {
        await playCombatSmashWinnerLoser(defender, attacker);
        this.controller.abilityManager.handleFinalAct(attacker, defender);
        if (elderDefender) sendToDeckInstead(attacker);
        else this.controller.destroyCard(attacker, attacker.data.isEnemy, idx, false, { cardName: defender.data.name, cause: 'combat' });
        await this.controller.abilityManager.handlePostCombat(defender);
      } else {
        this.controller.addLog(`${attacker.data.name} is Protected or Invincible. ${defender.data.name} is stymied.`);
        stymied = true;
      }
    } else {
      this.controller.addLog(`Mutual destruction: ${attacker.data.name} and ${defender.data.name}`);

      const attackerWillDie = !wrathAttackerCannotBeDestroyedByDefender && !attacker.data.isInvincible && !isAProtected;
      const defenderWillDie = !wrathDefenderCannotBeDestroyedByAttacker && !defender.data.isInvincible && !isDProtected;

      if (attackerWillDie || defenderWillDie) {
        if (attackerWillDie && !defenderWillDie) await playCombatSmashWinnerLoser(defender, attacker);
        else if (defenderWillDie && !attackerWillDie) await playCombatSmashWinnerLoser(attacker, defender);
        else await playCombatSmashMutual(attacker, defender);
      }

      if (wrathAttackerCannotBeDestroyedByDefender) {
        this.controller.addLog(`${attacker.data.name} cannot be destroyed (${defender.data.name} has Weakness Markers).`);
        stymied = true;
      } else if (!attacker.data.isInvincible && !isAProtected) {
        this.controller.abilityManager.handleFinalAct(attacker, defender);
        if (elderDefender) sendToDeckInstead(attacker);
        else this.controller.destroyCard(attacker, attacker.data.isEnemy, idx, false, { cardName: defender.data.name, cause: 'combat' });
      } else if (attacker.data.isInvincible) {
        stymied = true;
      }
      if (wrathDefenderCannotBeDestroyedByAttacker) {
        this.controller.addLog(`${defender.data.name} cannot be destroyed (${attacker.data.name} has Weakness Markers).`);
        stymied = true;
      } else if (!defender.data.isInvincible && !isDProtected) {
        this.controller.abilityManager.handleFinalAct(defender, attacker);
        if (elderAttacker) sendToDeckInstead(defender);
        else this.controller.destroyCard(defender, defender.data.isEnemy, idx, isAgainstChamp, { cardName: attacker.data.name, cause: 'combat' });
      } else if (defender.data.isInvincible) {
        stymied = true;
      }
    }
    // Wild Wolf: Any creature that does battle with Wild Wolf is destroyed at end of the round.
    const applyWildWolfMark = (wolf: CardEntity, other: CardEntity | null) => {
      if (!other) return;
      // Only mark if the other creature is still in play after combat
      const inPlay =
        this.controller.playerBattlefield.includes(other) ||
        this.controller.enemyBattlefield.includes(other) ||
        this.controller.seals.some(s => s.champion === other);
      if (inPlay) {
        other.data.markedByWildWolf = true;
        other.updateVisualMarkers();
        this.controller.addLog(`${wolf.data.name} marks ${other.data.name} for destruction at end of round.`);
      }
    };

    if (attacker.data.name === "Wild Wolf") {
      applyWildWolfMark(attacker, defender);
    } else if (defender.data.name === "Wild Wolf") {
      applyWildWolfMark(defender, attacker);
    }

    await new Promise(r => setTimeout(r, 500));
    return stymied;
  }

  private async cleanupEndOfRoundEffects() {
    // Wild Wolf: collect ALL marked cards first (battlefield + champions), then destroy — avoids missing cards that moved (e.g. ascended)
    const wildWolfVictims: { card: CardEntity; isEnemy: boolean; idx: number; isChampion: boolean }[] = [];
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      const pCard = this.controller.playerBattlefield[i];
      if (pCard && pCard.data.markedByWildWolf) wildWolfVictims.push({ card: pCard, isEnemy: false, idx: i, isChampion: false });
      const eCard = this.controller.enemyBattlefield[i];
      if (eCard && eCard.data.markedByWildWolf) wildWolfVictims.push({ card: eCard, isEnemy: true, idx: i, isChampion: false });
    }
    this.controller.seals.forEach((seal, idx) => {
      const champ = seal.champion;
      if (champ && champ.data.markedByWildWolf) wildWolfVictims.push({ card: champ, isEnemy: champ.data.isEnemy, idx, isChampion: true });
    });
    for (const { card, isEnemy, idx, isChampion } of wildWolfVictims) {
      this.controller.destroyCard(card, isEnemy, idx, isChampion, { cardName: 'Wild Wolf', cause: 'ability' });
      card.data.markedByWildWolf = false;
    }

    // Resolve Delta's end-of-round sacrifice and buff
    // Enemy Delta: sacrifice and pick the strongest ally (by effective Power Value) to receive +3.
    // If Delta is the strongest target, allow it to buff itself.
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      const eCard = this.controller.enemyBattlefield[i];
      if (eCard && eCard.data.name === "Delta" && eCard.data.pendingDeltaSacrifice) {
        const enemyAllies = [
          ...this.controller.enemyBattlefield,
          ...this.controller.seals.map(s => s.champion)
        ].filter(c => c !== null) as CardEntity[];

        const effectivePower = (card: CardEntity) =>
          card.data.power + card.data.powerMarkers - card.data.weaknessMarkers;

        const target = enemyAllies.reduce((best, current) =>
          effectivePower(current) > effectivePower(best) ? current : best
        , enemyAllies[0]);

        target.data.powerMarkers += 3;
        target.updateVisualMarkers();
        this.controller.addLog(`${target.data.name} receives +3 Power Markers from Delta's sacrifice.`);

        eCard.data.pendingDeltaSacrifice = false;
        this.controller.destroyCard(eCard, true, i, false);
      }
    }

    // Noble: End of Turn — +2 Power Marker on this creature
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      for (const card of [this.controller.playerBattlefield[i], this.controller.enemyBattlefield[i]]) {
        if (card && card.data.name === "Noble") {
          card.data.powerMarkers += 2;
          card.updateVisualMarkers();
          this.controller.addLog(`${card.data.name} gains +2 Power Markers at end of turn.`);
        }
      }
    }
    this.controller.seals.forEach((seal) => {
      const champ = seal.champion;
      if (champ && champ.data.name === "Noble") {
        champ.data.powerMarkers += 2;
        champ.updateVisualMarkers();
        this.controller.addLog(`${champ.data.name} gains +2 Power Markers at end of turn.`);
      }
    });

    // Final End-of-Round Optional Abilities (player chooses)
    // Currently supports Delta's end-of-round sacrifice choice.
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      const pCard = this.controller.playerBattlefield[i];
      if (pCard && pCard.data.name === "Delta" && pCard.data.pendingDeltaSacrifice) {
        this.controller.updateState({
          decisionContext: 'DELTA_SACRIFICE',
          instructionText: "Use Delta to sacrifice itself and grant +3 Power Markers to a creature?",
          decisionMessage: "Delta will be sacrificed. You will then choose one creature to receive +3 Power Markers. Use this ability?"
        });

        const confirmed = await new Promise<boolean>((resolve) => {
          (this.controller as any).nullifyCallback = resolve;
        });

        this.controller.updateState({ decisionContext: undefined, decisionMessage: undefined });

        if (confirmed) {
          this.controller.addLog(`${pCard.data.name} sacrifices itself to empower an ally.`);

          // Enter targeting: reward is applied to the chosen card; then GameController destroys Delta.
          (this.controller as any).pendingDeltaSacrificeSource = pCard;
          (this.controller as any).pendingDeltaSacrificeSourceIdx = i;

          // Zoom out so player can see the board, then wait for them to select a creature for +3
          this.controller.zoomOut();
          await new Promise(r => setTimeout(r, 1200)); // Let zoom animation complete
          this.controller.updateState({
            currentPhase: Phase.DELTA_BUFF_TARGETING,
            instructionText: "Select a creature to receive +3 Power Markers from Delta's sacrifice. (Delta can be selected.)"
          });

          await new Promise<void>((resolve) => {
            (this.controller as any).resolutionCallback = resolve;
          });

          // If the interaction was skipped/canceled, ensure Delta isn't left pending.
          if ((this.controller as any).pendingDeltaSacrificeSource) {
            (this.controller as any).pendingDeltaSacrificeSource.data.pendingDeltaSacrifice = false;
            (this.controller as any).pendingDeltaSacrificeSource = null;
            (this.controller as any).pendingDeltaSacrificeSourceIdx = -1;
          }
        } else {
          pCard.data.pendingDeltaSacrifice = false;
        }
      }
    }

    // Fledgeling: Sacrifice at end of the turn
    for (let i = 0; i < GAME_CONSTANTS.SEVEN; i++) {
      const pCard = this.controller.playerBattlefield[i];
      if (pCard && pCard.data.sacrificeEndOfTurn) {
        this.controller.addLog(`${pCard.data.name} is sacrificed at end of turn.`);
        this.controller.destroyCard(pCard, false, i, false);
      }
      const eCard = this.controller.enemyBattlefield[i];
      if (eCard && eCard.data.sacrificeEndOfTurn) {
        this.controller.addLog(`${eCard.data.name} is sacrificed at end of turn.`);
        this.controller.destroyCard(eCard, true, i, false);
      }
    }
  }

  public async handleSiege(idx: number, attacker: CardEntity | null, isPlayer: boolean) {
    const aPow = attacker ? attacker.data.power + attacker.data.powerMarkers - attacker.data.weaknessMarkers : 0;
    
    if (aPow > 0 || !attacker) {
      const pAlign = this.controller.state.playerAlignment;
      const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
      const targetAlign = isPlayer ? pAlign : eAlign;
      this.controller.addLog(`${isPlayer ? 'Player' : 'Enemy'} influences Seal ${idx + 1} towards ${targetAlign}`);
      await this.controller.claimSeal(idx, targetAlign, {
        type: 'combat',
        cardName: attacker!.data.name
      });
    }
  }

  public checkGameOver() {
    const pAlign = this.controller.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    const pCount = this.controller.seals.filter(s => s.alignment === pAlign).length;
    const eCount = this.controller.seals.filter(s => s.alignment === eAlign).length;
    const bothDecksEmpty = this.controller.playerDeck.length === 0 && this.controller.enemyDeck.length === 0;

    if (pCount >= 4 || eCount >= 4 || bothDecksEmpty) {
      let winCondition: string;
      if (bothDecksEmpty) {
        winCondition = "Draw (both decks exhausted)";
      } else if (pCount >= 4 || eCount >= 4) {
        const winnerCount = pCount > eCount ? pCount : eCount;
        winCondition = winnerCount === 7 ? "All Seven Seals" : `Majority of Seals (${winnerCount} of 7)`;
      } else {
        winCondition = "Draw";
      }
      this.finalizeGame(winCondition);
    }
  }

  public finalizeGame(winCondition?: string) {
    const pAlign = this.controller.state.playerAlignment;
    const eAlign = pAlign === Alignment.LIGHT ? Alignment.DARK : Alignment.LIGHT;
    const pCount = this.controller.seals.filter(s => s.alignment === pAlign).length;
    const eCount = this.controller.seals.filter(s => s.alignment === eAlign).length;

    let body = "";
    let result: 'player' | 'enemy' | 'draw';

    if (pCount > eCount) {
      body = pAlign === Alignment.LIGHT 
        ? "The Seventh Seal is Purified. The cycle of Light begins anew, casting away the shadows of the void."
        : "The Void has consumed the threshold. The world yields to the eternal rhythm of the Dark.";
      this.controller.addLog("GAME OVER: Player Victory");
      result = 'player';
    } else if (eCount > pCount) {
      body = pAlign === Alignment.LIGHT
        ? "The Light has flickered out. The opponent's corruption has claimed the world's essence."
        : "The Light has unexpectedly pierced the veil. Your dominion of shadow has been repelled.";
      this.controller.addLog("GAME OVER: Enemy Victory");
      result = 'enemy';
    } else {
      body = "The scales remain perfectly balanced. Neither Light nor Shadow can claim the throne of existence.";
      this.controller.addLog("GAME OVER: Draw");
      result = 'draw';
    }

    this.controller.updateState({ 
      currentPhase: Phase.GAME_OVER, 
      instructionText: body,
      gameOverResult: result,
      gameOverWinCondition: winCondition ?? (result === 'draw' ? "Draw" : "Majority of Seals")
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
    card.applyBackTextureIfNeeded(); // All cards share same back graphic
    // Ensure power/weakness marker visuals persist when card moves to seal (e.g. Alpha +2 from destroying enemy)
    card.updateVisualMarkers();
    this.controller.abilityManager.syncBoardPresencePowerMarkers();
    gsap.to(card.mesh.position, {
      x: this.controller.seals[idx].mesh.position.x,
      y: 0.6,
      z: 0,
      duration: 0.6,
      ease: "back.out"
    });
  }
}
