/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('gsap', () => ({
  default: {
    killTweensOf: vi.fn(),
    to: vi.fn(),
  },
}));

import { playerHandPrepHandOffset } from '../prepHandLayout';
import { executePrepUndoEntry } from '../prepUndo';
import type { CardEntity } from '../../entities/CardEntity';

function makeCard(name: string): CardEntity {
  return {
    data: { name } as CardEntity['data'],
    mesh: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    resetHoverLift: vi.fn(),
    applyBackTextureIfNeeded: vi.fn(),
    updateVisualMarkers: vi.fn(),
  } as unknown as CardEntity;
}

describe('prepHandLayout', () => {
  it('playerHandPrepHandOffset matches historical eight-slot fan', () => {
    expect(playerHandPrepHandOffset(0)).toBe(-3.5);
    expect(playerHandPrepHandOffset(7)).toBe(3.5);
    expect(playerHandPrepHandOffset(4)).toBe(0.5);
  });
});

describe('executePrepUndoEntry', () => {
  let updateState: ReturnType<typeof vi.fn>;
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateState = vi.fn();
    sync = vi.fn();
  });

  function slice(over: Partial<Parameters<typeof executePrepUndoEntry>[0]> = {}) {
    return {
      playerHand: [] as CardEntity[],
      playerBattlefield: Array(7).fill(null) as (CardEntity | null)[],
      playerLimbo: [] as CardEntity[],
      abilityManager: { syncBoardPresencePowerMarkers: sync },
      updateState,
      ...over,
    };
  }

  it('place undo clears slot and returns card to hand', () => {
    const card = makeCard('Test');
    const battle = Array(7).fill(null) as (CardEntity | null)[];
    battle[2] = card;
    const hand: CardEntity[] = [];
    executePrepUndoEntry(slice({ playerHand: hand, playerBattlefield: battle }), {
      type: 'place',
      slotIndex: 2,
      card,
    });
    expect(battle[2]).toBeNull();
    expect(hand).toContain(card);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(updateState).toHaveBeenCalledWith({});
  });

  it('baron swap undo restores baron on battlefield and limbo card in limbo', () => {
    const baron = makeCard('Baron');
    const limboCard = makeCard('Swap');
    const battle = Array(7).fill(null) as (CardEntity | null)[];
    battle[1] = limboCard;
    const limbo: CardEntity[] = [baron];
    executePrepUndoEntry(slice({ playerBattlefield: battle, playerLimbo: limbo }), {
      type: 'baron_swap',
      slotIndex: 1,
      baron,
      limboCard,
    });
    expect(battle[1]).toBe(baron);
    expect(limbo).toContain(limboCard);
    expect(limbo).not.toContain(baron);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(updateState).toHaveBeenCalledWith({});
  });
});
