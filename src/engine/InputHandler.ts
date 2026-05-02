/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

type InputPointerEvent = MouseEvent | PointerEvent;

export class InputHandler {
  public mouse: THREE.Vector2;
  public raycaster: THREE.Raycaster;
  private camera: THREE.Camera;
  private domElement: HTMLElement;

  public onMouseDown: ((event: InputPointerEvent) => void) | null = null;
  public onMouseMove: ((event: InputPointerEvent) => void) | null = null;
  private readonly supportsPointerEvents: boolean;
  private readonly handlePointerMoveBound: (event: PointerEvent) => void;
  private readonly handlePointerDownBound: (event: PointerEvent) => void;
  private readonly handleMouseMoveBound: (event: MouseEvent) => void;
  private readonly handleMouseDownBound: (event: MouseEvent) => void;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;

    this.handlePointerMoveBound = this.handlePointerMove.bind(this);
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleMouseDownBound = this.handleMouseDown.bind(this);

    if (this.supportsPointerEvents) {
      window.addEventListener('pointermove', this.handlePointerMoveBound, { passive: true });
      window.addEventListener('pointerdown', this.handlePointerDownBound);
    } else {
      window.addEventListener('mousemove', this.handleMouseMoveBound, { passive: true });
      window.addEventListener('mousedown', this.handleMouseDownBound);
    }
  }

  private setPointerFromClientCoords(clientX: number, clientY: number) {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  private handlePointerMove(event: PointerEvent) {
    this.setPointerFromClientCoords(event.clientX, event.clientY);
    if (this.onMouseMove) this.onMouseMove(event);
  }

  private handlePointerDown(event: PointerEvent) {
    this.setPointerFromClientCoords(event.clientX, event.clientY);
    if (this.onMouseDown) this.onMouseDown(event);
  }

  private handleMouseMove(event: MouseEvent) {
    this.setPointerFromClientCoords(event.clientX, event.clientY);
    if (this.onMouseMove) this.onMouseMove(event);
  }

  private handleMouseDown(event: MouseEvent) {
    this.setPointerFromClientCoords(event.clientX, event.clientY);
    if (this.onMouseDown) this.onMouseDown(event);
  }

  public dispose() {
    if (this.supportsPointerEvents) {
      window.removeEventListener('pointermove', this.handlePointerMoveBound);
      window.removeEventListener('pointerdown', this.handlePointerDownBound);
    } else {
      window.removeEventListener('mousemove', this.handleMouseMoveBound);
      window.removeEventListener('mousedown', this.handleMouseDownBound);
    }
  }
}
