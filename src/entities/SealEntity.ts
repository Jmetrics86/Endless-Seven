/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Alignment } from '../types';
import { CardEntity } from './CardEntity';
import { GameEntity } from '../engine/EntityManager';

export class SealEntity implements GameEntity {
  public mesh: THREE.Mesh;
  public light: THREE.PointLight;
  public alignment: Alignment;
  public champion: CardEntity | null = null;
  public index: number;

  constructor(x: number, index: number) {
    this.index = index;
    this.alignment = Alignment.NEUTRAL;

    this.mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.25, 0.25, 6),
      new THREE.MeshPhongMaterial({ color: 0x222222, emissive: 0x080808 })
    );
    this.mesh.position.set(x, 0.1, 0);

    this.light = new THREE.PointLight(0xffffff, 0, 12);
    this.light.position.set(x, 2, 0);
  }

  public setAlignment(status: Alignment) {
    this.alignment = status;
    let color = 0x080808;
    if (status === Alignment.LIGHT) color = 0x00f2ff;
    if (status === Alignment.DARK) color = 0xff0044;

    const material = this.mesh.material as THREE.MeshPhongMaterial;
    material.emissive.setHex(color);
    material.emissiveIntensity = status === Alignment.NEUTRAL ? 0.1 : 0.8;
    this.light.color.setHex(color);
    this.light.intensity = status === Alignment.NEUTRAL ? 0 : 3.5;
  }

  public update(time: number) {
    if (this.alignment !== Alignment.NEUTRAL) {
      const material = this.mesh.material as THREE.MeshPhongMaterial;
      material.emissiveIntensity = 1.0 + Math.sin(time * 8) * 0.8;
    }
  }

  public dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
