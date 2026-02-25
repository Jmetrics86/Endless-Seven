/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface GameEntity {
  mesh: THREE.Object3D;
  update(time: number): void;
  dispose(): void;
}

export class EntityManager {
  private entities: Set<GameEntity>;

  constructor() {
    this.entities = new Set();
  }

  public add(entity: GameEntity) {
    this.entities.add(entity);
  }

  public remove(entity: GameEntity) {
    entity.dispose();
    this.entities.delete(entity);
  }

  public update(time: number) {
    this.entities.forEach(entity => entity.update(time));
  }

  public clear() {
    this.entities.forEach(entity => entity.dispose());
    this.entities.clear();
  }
}
