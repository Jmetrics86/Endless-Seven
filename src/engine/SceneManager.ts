/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cameraTarget: THREE.Vector3;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.015);

    this.cameraTarget = new THREE.Vector3(0, 0, -2);
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 28, 32);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting() {
    // Dim ambient light for more contrast
    const amb = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(amb);

    // Main cyan light
    const sky = new THREE.PointLight(0x00f2ff, 2.5, 150);
    sky.position.set(0, 30, 10);
    this.scene.add(sky);

    // Dramatic purple rim light
    const rim = new THREE.DirectionalLight(0xff00ff, 1.2);
    rim.position.set(-20, 30, -20);
    this.scene.add(rim);

    // Warm accent light
    const accent = new THREE.PointLight(0xffaa00, 1.5, 80);
    accent.position.set(20, 15, 20);
    this.scene.add(accent);

    // Front fill light
    const pLight = new THREE.PointLight(0xffffff, 1.2, 60);
    pLight.position.set(0, 20, 25);
    this.scene.add(pLight);
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public update() {
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.dispose();
  }
}
