/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CardData } from './types';

export const LIGHT_POOL: CardData[] = [
  { name: "The Spinner", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Champion. Flip: +1 Power per Acolyte in play. Activate: Win if 4 Acolytes in play and at least one Champion on a Seal.", markerPower: 0, needsAllocation: true, hasActivate: true },
  { name: "The Allotter", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Champion. Flip: Destroy any card on any Seal. Activate: Destroy one Marker of any type.", hasTargetedAbility: true, effect: 'destroy', targetType: 'any', hasActivate: true },
  { name: "Prophet", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Champion. While in play, Purified Seals cannot be Corrupted." },
  { name: "The Inevitable", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Champion. After destroying a creature in battle, you may destroy another card or Marker in play." },
  { name: "Saint Michael", faction: "Light", type: "Avatar", power: 10, isChampion: true, ability: "Champion. Activate: If you control 5+ Seals with Champions, you win. Final Act: In Limbo, move to Graveyard to destroy a card that battled this turn.", hasActivate: true, hasLimboAbility: true },
  { name: "Martyr", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Champion. When placed in Limbo, Purify any one Neutral Seal without a Champion.", hasLimboAbility: true },
  { name: "The Almighty", faction: "Light", type: "God", power: 15, isChampion: true, ability: "Champion. Flip: Purify any Corrupted Seal without a Champion. Activate: Destroy all instances of one marker type (all Power, all Weakness, etc.).", hasSealTargetAbility: true, sealEffect: 'LIGHT', hasActivate: true },
  { name: "Archangel", faction: "Celestial", type: "Creature", power: 2, isChampion: false, ability: "Flip: Reveal enemy card and Nullify its Flip ability.", hasNullify: true },
  { name: "Cherubim", faction: "Celestial", type: "Creature", power: 4, isChampion: false, ability: "Flip: Return target creature in play to owner's deck.", hasTargetedAbility: true, effect: 'return', targetType: 'creature' },
  { name: "Fallen One", faction: "Celestial", type: "Creature", power: 6, isChampion: false, ability: "Haste: Resolve battle before Flip.", hasHaste: true, hasLimboAbility: true },
  { name: "Herald", faction: "Celestial", type: "Creature", power: 5, isChampion: false, ability: "Flip: Gain Power Markers equal to the top card of your deck." },
  { name: "Nephilim", faction: "Celestial", type: "Creature", power: 3, isChampion: false, ability: "Flip: Battle invulnerability this round. Activate: Choose a Seal. Enemy cannot change influence of that Seal until end of round.", hasActivate: true },
  { name: "Seraphim", faction: "Celestial", type: "Creature", power: 7, isChampion: true, ability: "Champion. Passive: While on a Seal, other Celestials are immune to creature abilities. Activate: Destroy one Marker.", hasTargetedAbility: true, effect: 'destroy_marker', targetType: 'any', hasActivate: true },
  { name: "Thrones", faction: "Celestial", type: "Creature", power: 1, isChampion: false, ability: "Flip: Change Influence of empty Seal." },
  { name: "Alpha", faction: "Lycan", type: "Creature", power: 7, isChampion: true, ability: "Champion. Haste: Resolves combat before Flip. Effect: Place a +2 Power Marker on this creature after destroying an Enemy creature in battle.", hasHaste: true },
  { name: "Beta", faction: "Lycan", type: "Creature", power: 6, isChampion: false, ability: "Flip: Cannot be destroyed by battle this turn. Action: Place a +2 Power Marker on any adjacent creature." },
  { name: "Omega", faction: "Lycan", type: "Creature", power: 5, isChampion: false, ability: "Flip: Gain a +1 Power Marker for each Lycan in play and in Limbo." },
  { name: "Sentinel", faction: "Lycan", type: "Creature", power: 4, isChampion: false, ability: "Flip: Choose a creature in Limbo, place Power Markers on this creature equal to that creature's Power Value.", hasTargetedAbility: true, effect: 'sentinel_absorb', targetType: 'limbo_creature' },
  { name: "Delta", faction: "Lycan", type: "Creature", power: 3, isChampion: false, ability: "Flip: Place a +1 Power Marker on up to any 3 creatures in play. Activate: Sacrifice this creature at the end of the round and place a +3 Power Marker on any creature.", markerPower: 3, needsAllocation: true, hasActivate: true },
  { name: "Luna", faction: "Lycan", type: "Creature", power: 2, isChampion: false, ability: "Final Act: While in Limbo, if your Enemy changes the Influence of a Seal without a Champion, you may move Luna into the Graveyard to Nullify that action." },
  { name: "Wild Wolf", faction: "Lycan", type: "Creature", power: 1, isChampion: false, ability: "Haste: Resolves battle before Flip abilities. Effect: Any creature that does battle with Wild Wolf is destroyed at the end of the round.", hasHaste: true }
];

export const DARK_POOL: CardData[] = [
  { name: "Death", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Flip: Target card loses 5 Power.", markerWeakness: 5, needsAllocation: true },
  { name: "Famine", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Flip: Destroy any card in play.", hasTargetedAbility: true, effect: 'destroy', targetType: 'any' },
  { name: "Pestilence", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Flip: All enemy creatures lose 2 Power.", markerWeakness: 2, needsAllocation: true },
  { name: "War", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Post-Combat: Gain 3 Power Markers after destroying a creature." },
  { name: "Lilith", faction: "Darkness", type: "Avatar", power: 10, isChampion: true, ability: "Win Con: Activate with 7 Seals." },
  { name: "Hades", faction: "Darkness", type: "Avatar", power: 9, isChampion: true, ability: "Flip: Gain 2 Power Markers.", markerPower: 2, needsAllocation: true },
  { name: "The Destroyer", faction: "Darkness", type: "God", power: 15, isChampion: true, ability: "Flip: Corrupt un-championed Light Seals.", hasGlobalAbility: true, effect: 'corrupt_undefended' },
  { name: "Wrath", faction: "Daemon", type: "Creature", power: 7, isChampion: true, ability: "Champion. Flip: Place a -1 Weakness Marker on each of your enemy's creatures. Passive: Wrath cannot be destroyed in battle by any creature with a Weakness Marker.", markerWeakness: 1 },
  { name: "Pride", faction: "Daemon", type: "Creature", power: 6, isChampion: false, ability: "Flip: Place a -3 Weakness Marker on the creature across from Pride. Action: Place a +2 Power Marker on any adjacent creature.", markerWeakness: 3 },
  { name: "Greed", faction: "Daemon", type: "Creature", power: 5, isChampion: false, ability: "Flip: Cannot be destroyed by battle this turn. Activate: Transfer all Power Markers in play to this creature.", hasActivate: true },
  { name: "Sloth", faction: "Daemon", type: "Creature", power: 4, isChampion: false, ability: "Passive: Unaffected by abilities. Flip: Place a -3 Weakness Marker on any creature in play. Action: Destroy any creature in play with Weakness Markers.", abilityImmune: true, hasTargetedAbility: true, effect: 'place_weakness', targetType: 'creature', markerWeakness: 3 },
  { name: "Envy", faction: "Daemon", type: "Creature", power: 3, isChampion: false, ability: "Flip: Place a -3 Weakness Marker on any creature with Power Value equal to or greater than this creature.", hasTargetedAbility: true, effect: 'place_weakness', targetType: 'creature_power_gte', markerWeakness: 3 },
  { name: "Lust", faction: "Daemon", type: "Creature", power: 2, isChampion: false, ability: "Flip: Both Enemy and Ally sacrifice a creature at this position (including Lust). Effect: After sacrifice, if the Seal has no Champion, you may change the Influence of the seal.", hasLustSealEffect: true },
  { name: "Gluttony", faction: "Daemon", type: "Creature", power: 1, isChampion: false, ability: "Flip: Transfer all Power Markers in play to this creature.", hasGlobalAbility: true, effect: 'siphon_power_only' },
  { name: "Lord", faction: "Vampyre", type: "Creature", power: 7, isChampion: true, ability: "Champion. Flip: Place any Champion on top of its owner's deck. Activate: Place a +1 Power Marker on Lord for each Vampyre in play.", hasTargetedAbility: true, effect: 'return', targetType: 'champion', hasActivate: true },
  { name: "Duke", faction: "Vampyre", type: "Creature", power: 6, isChampion: false, ability: "Flip: Place a creature in play on top of that player's deck. Continuous: While Duke is in Play, your creatures are considered Vampyre.", hasTargetedAbility: true, effect: 'return', targetType: 'creature' },
  { name: "Elder", faction: "Vampyre", type: "Creature", power: 5, isChampion: false, ability: "Haste: Resolve battle before Flip abilities. Effect: Any creature that battles Elder is placed on top of its owner's deck.", hasHaste: true },
  { name: "Noble", faction: "Vampyre", type: "Creature", power: 4, isChampion: false, ability: "Flip: Destroy any one creature in play. End of Turn: At the end of the turn, place a +2 Power Marker on this creature.", hasTargetedAbility: true, effect: 'destroy', targetType: 'creature' },
  { name: "Regent", faction: "Vampyre", type: "Creature", power: 3, isChampion: false, ability: "Flip: Change the Influence of any Seal without a Champion.", hasSealTargetAbility: true },
  { name: "Baron", faction: "Vampyre", type: "Creature", power: 2, isChampion: false, ability: "Flip: Nullify any creature's Flip ability at this position. Swap: Swap this creature with any creature in Limbo you control.", hasNullify: true, hasSwapAbility: true },
  { name: "Fledgeling", faction: "Vampyre", type: "Creature", power: 1, isChampion: false, ability: "Passive: Cannot battle or be battled. Flip: While this creature is in play, place a +3 Power Marker on any creature in play. Sacrifice: Sacrifice this creature at the end of the turn.", hasTargetedAbility: true, effect: 'place_power', targetType: 'creature', markerPower: 3, cannotBattleOrBeBattled: true, sacrificeEndOfTurn: true }
];

export const GAME_CONSTANTS = {
  SEVEN: 7,
  SLOT_SPACING: 3.8,
  CARD_W: 2.2,
  CARD_H: 3.2,
  TABLE_SIZE: 400
};

export const GAME_VERSION = "v0.1.3";
