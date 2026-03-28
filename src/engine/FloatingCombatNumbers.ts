/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import gsap from 'gsap';
import type { CardEntity } from '../entities/CardEntity';

const IMPACT_DELAY_MS = 200;
const FLOAT_DURATION = 0.95;
const RISE_Y = 1.35;
const SIDE_OFFSET = 0.55;

function makePowerSprite(text: string, color: string): THREE.Sprite {
  const fontPx = 56;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontPx}px Cinzel, Georgia, serif`;
  const metrics = ctx.measureText(text);
  const pad = 16;
  canvas.width = Math.ceil(Math.max(metrics.width, 1) + pad * 2);
  canvas.height = fontPx + pad * 2;
  ctx.font = `bold ${fontPx}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const h = 1.05;
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(h * aspect, h, 1);
  return sprite;
}

function disposeSprite(sprite: THREE.Sprite): void {
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
  sprite.removeFromParent();
}

function spawnValueFloat(
  scene: THREE.Scene,
  worldX: number,
  worldY: number,
  worldZ: number,
  value: number,
  color: string,
  sideSign: number
): void {
  const text = String(value);
  const sprite = makePowerSprite(text, color);
  sprite.position.set(worldX + sideSign * SIDE_OFFSET, worldY + 0.75, worldZ);
  (sprite.material as THREE.SpriteMaterial).opacity = 0;
  scene.add(sprite);

  gsap.to(sprite.position, { y: worldY + 0.75 + RISE_Y, duration: FLOAT_DURATION, ease: 'power2.out' });
  gsap.to(sprite.material as THREE.SpriteMaterial, {
    opacity: 1,
    duration: 0.12,
    ease: 'power2.out',
    onComplete: () => {
      gsap.to(sprite.material as THREE.SpriteMaterial, {
        opacity: 0,
        duration: FLOAT_DURATION * 0.55,
        delay: FLOAT_DURATION * 0.25,
        ease: 'power2.in',
        onComplete: () => disposeSprite(sprite),
      });
    },
  });
}

function cardWorldY(card: CardEntity): number {
  const p = card.mesh?.position;
  if (!p || typeof p.y !== 'number') return 0.35;
  return p.y;
}

/**
 * After a short delay (aligned with combat impact), spawns floating text at the **player's** card only:
 * - White: effective power they deal this exchange.
 * - Red: effective power they take from the opponent.
 */
export function scheduleCombatExchangeFloats(
  scene: THREE.Scene,
  attacker: CardEntity,
  defender: CardEntity,
  attackerPower: number,
  defenderPower: number
): void {
  setTimeout(() => {
    const ax = attacker.mesh?.position?.x ?? 0;
    const az = attacker.mesh?.position?.z ?? 0;
    const dx = defender.mesh?.position?.x ?? 0;
    const dz = defender.mesh?.position?.z ?? 0;

    const ay = cardWorldY(attacker);
    const dy = cardWorldY(defender);

    // Player side only (CPU cards do not get floating numbers)
    if (!attacker.data.isEnemy) {
      spawnValueFloat(scene, ax, ay, az, attackerPower, '#f5f5f5', -1);
      spawnValueFloat(scene, ax, ay, az, defenderPower, '#ff3355', 1);
    }
    if (!defender.data.isEnemy) {
      spawnValueFloat(scene, dx, dy, dz, defenderPower, '#f5f5f5', -1);
      spawnValueFloat(scene, dx, dy, dz, attackerPower, '#ff3355', 1);
    }
  }, IMPACT_DELAY_MS);
}
