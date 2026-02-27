/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CardData } from './types';

export const LIGHT_POOL: CardData[] = [
  { name: "The Spinner", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Flip: Gain +1 Power Marker for every Light card currently in play.", markerPower: 0, needsAllocation: true },
  { name: "The Allotter", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Flip: Destroy card on any Seal.", hasTargetedAbility: true, effect: 'destroy', targetType: 'any' },
  { name: "Prophet", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Passive: Prevents Purified Seals from being Corrupted while in play." },
  { name: "The Inevitable", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Post-Combat: After destroying a creature, gain 2 Power Markers." },
  { name: "Saint Michael", faction: "Light", type: "Avatar", power: 10, isChampion: true, ability: "Win Con: Activate with 7 Seals. Final Act: Target battled card loses 3 Power." },
  { name: "Martyr", faction: "Light", type: "Avatar", power: 9, isChampion: true, ability: "Limbo Trigger: Purify one Neutral Seal without a Champion.", hasLimboAbility: true },
  { name: "The Almighty", faction: "Light", type: "God", power: 15, isChampion: true, ability: "Flip: Purify a Corrupted Seal without a Champion.", hasSealTargetAbility: true, sealEffect: 'LIGHT' },
  { name: "Archangel", faction: "Celestial", type: "Creature", power: 2, isChampion: false, ability: "Flip: Reveal enemy card and Nullify its Flip ability.", hasNullify: true },
  { name: "Cherubim", faction: "Celestial", type: "Creature", power: 4, isChampion: false, ability: "Flip: Return target creature in play to owner's deck.", hasTargetedAbility: true, effect: 'return', targetType: 'creature' },
  { name: "Fallen One", faction: "Celestial", type: "Creature", power: 6, isChampion: false, ability: "Haste: Resolve battle before Flip.", hasHaste: true, hasLimboAbility: true },
  { name: "Herald", faction: "Celestial", type: "Creature", power: 5, isChampion: false, ability: "Flip: Gain Power Markers equal to the top card of your deck." },
  { name: "Nephilim", faction: "Celestial", type: "Creature", power: 3, isChampion: false, ability: "Flip: Battle invulnerability this round. Activate: Choose a Seal. Enemy cannot change influence of that Seal until end of round.", hasActivate: true },
  { name: "Seraphim", faction: "Celestial", type: "Creature", power: 7, isChampion: true, ability: "Champion. Passive: While on a Seal, other Celestials are immune to creature abilities. Activate: Destroy one Marker.", hasTargetedAbility: true, effect: 'destroy_marker', targetType: 'any', hasActivate: true },
  { name: "Thrones", faction: "Angel", type: "Creature", power: 1, isChampion: false, ability: "Flip: Change Influence of empty Seal." },
  { name: "Alpha", faction: "Lycan", type: "Creature", power: 7, isChampion: false, ability: "Haste: Combat first. Gain 2 Power Markers after victory.", hasHaste: true },
  { name: "Beta", faction: "Lycan", type: "Creature", power: 6, isChampion: false, ability: "Flip: Battle invulnerability. Buff adjacent unit +2." },
  { name: "Omega", faction: "Lycan", type: "Creature", power: 5, isChampion: false, ability: "Flip: +1 Power Marker for every Lycan in Play.", markerPower: 1, needsAllocation: true },
  { name: "Sentinel", faction: "Lycan", type: "Creature", power: 4, isChampion: false, ability: "Flip: Target card loses 2 Power.", markerWeakness: 2, needsAllocation: true },
  { name: "Delta", faction: "Lycan", type: "Creature", power: 3, isChampion: false, ability: "Flip: Buff 3 cards +1 Power each.", markerPower: 3, needsAllocation: true },
  { name: "Luna", faction: "Lycan", type: "Creature", power: 2, isChampion: false, ability: "Final Act: Nullify enemy Influence change." },
  { name: "Wild Wolf", faction: "Lycan", type: "Creature", power: 1, isChampion: false, ability: "Haste: Resolve combat first.", hasHaste: true }
];

export const DARK_POOL: CardData[] = [
  { name: "Death", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Flip: Target card loses 5 Power.", markerWeakness: 5, needsAllocation: true },
  { name: "Famine", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Flip: Destroy any card in play.", hasTargetedAbility: true, effect: 'destroy', targetType: 'any' },
  { name: "Pestilence", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Flip: All enemy creatures lose 2 Power.", markerWeakness: 2, needsAllocation: true },
  { name: "War", faction: "Darkness", type: "Horseman", power: 9, isChampion: true, ability: "Post-Combat: Gain 3 Power Markers after destroying a creature." },
  { name: "Lilith", faction: "Darkness", type: "Avatar", power: 10, isChampion: true, ability: "Win Con: Activate with 7 Seals." },
  { name: "Hades", faction: "Darkness", type: "Avatar", power: 9, isChampion: true, ability: "Flip: Gain 2 Power Markers.", markerPower: 2, needsAllocation: true },
  { name: "The Destroyer", faction: "Darkness", type: "God", power: 15, isChampion: true, ability: "Flip: Corrupt un-championed Light Seals.", hasGlobalAbility: true, effect: 'corrupt_undefended' },
  { name: "Wrath", faction: "Daemon", type: "Creature", power: 7, isChampion: false, ability: "Flip: Enemy loses 1 Power.", markerWeakness: 1, needsAllocation: true },
  { name: "Pride", faction: "Daemon", type: "Creature", power: 6, isChampion: false, ability: "Flip: Card across loses 3 Power.", markerWeakness: 3, needsAllocation: true },
  { name: "Greed", faction: "Daemon", type: "Creature", power: 5, isChampion: false, ability: "Flip: Battle invulnerability." },
  { name: "Sloth", faction: "Daemon", type: "Creature", power: 4, isChampion: false, ability: "Passive: Ability immune. Flip: -3 Weakness." },
  { name: "Envy", faction: "Daemon", type: "Creature", power: 3, isChampion: false, ability: "Flip: Target card loses 3 Power.", markerWeakness: 3, needsAllocation: true },
  { name: "Lust", faction: "Daemon", type: "Creature", power: 2, isChampion: false, ability: "Flip: Forced mutual sacrifice." },
  { name: "Gluttony", faction: "Daemon", type: "Creature", power: 1, isChampion: false, ability: "Flip: Siphon all Power and Weakness Markers in play to self.", hasGlobalAbility: true, effect: 'siphon_all' },
  { name: "Lord", faction: "Vampyre", type: "Creature", power: 7, isChampion: false, ability: "Flip: Gain 1 Power Marker for each Vampyre.", markerPower: 1, needsAllocation: true },
  { name: "Duke", faction: "Vampyre", type: "Creature", power: 6, isChampion: false, ability: "Flip: Spin creature to top of deck. Passive: Friendly count as Vampyre." },
  { name: "Elder", faction: "Vampyre", type: "Creature", power: 5, isChampion: false, ability: "Haste: Resolve combat first.", hasHaste: true },
  { name: "Noble", faction: "Vampyre", type: "Creature", power: 4, isChampion: false, ability: "Flip: Destroy one creature.", hasTargetedAbility: true, effect: 'destroy', targetType: 'creature' },
  { name: "Regent", faction: "Vampyre", type: "Creature", power: 3, isChampion: false, ability: "Flip: Change Influence of any Seal without a Champion." },
  { name: "Baron", faction: "Vampyre", type: "Creature", power: 2, isChampion: false, ability: "Flip: Nullify Flip here.", hasNullify: true },
  { name: "Fledgeling", faction: "Vampyre", type: "Creature", power: 1, isChampion: false, ability: "Flip: Gain 3 Power Markers.", markerPower: 3, needsAllocation: true }
];

export const GAME_CONSTANTS = {
  SEVEN: 7,
  SLOT_SPACING: 3.8,
  CARD_W: 2.2,
  CARD_H: 3.2,
  TABLE_SIZE: 400
};
