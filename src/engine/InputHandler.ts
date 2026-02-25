/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export class InputHandler {
  public mouse: THREE.Vector2;
  public raycaster: THREE.Raycaster;
  private camera: THREE.Camera;
  private domElement: HTMLElement;

  public onMouseDown: ((event: MouseEvent) => void) | null = null;
  public onMouseMove: ((event: MouseEvent) => void) | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mousedown', this.handleMouseDown.bind(this));
  }

  private handleMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.onMouseMove) this.onMouseMove(event);
  }

  private handleMouseDown(event: MouseEvent) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.onMouseDown) this.onMouseDown(event);
  }

  public dispose() {
    window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    window.removeEventListener('mousedown', this.handleMouseDown.bind(this));
  }
}
