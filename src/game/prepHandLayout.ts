/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared player hand layout math (Prep draw + undo place back to hand).
 */

import gsap from 'gsap';
import type { CardEntity } from '../entities/CardEntity';

/**
 * Horizontal fan index for Prep hand (matches historical PhaseManager draw: `i - 3.5`).
 * Uses fixed eight-slot spread so partial hands match original deal positions.
 */
export function playerHandPrepHandOffset(handIndex: number): number {
  return handIndex - 3.5;
}

/** Tween a card to its Prep hand pose (matches startPrepPhase). */
export function tweenPlayerHandCardToPrepPose(
  card: CardEntity,
  handIndex: number,
  duration = 0.5
): void {
  const offset = playerHandPrepHandOffset(handIndex);
  gsap.to(card.mesh.position, {
    x: offset * 2.15,
    y: 12,
    z: 21 + Math.abs(offset) * 0.3,
    duration,
    ease: 'power2.out',
  });
  gsap.to(card.mesh.rotation, { x: 0.85, y: offset * 0.06, duration, ease: 'power2.out' });
}
