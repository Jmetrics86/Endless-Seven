/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { EnvironmentTheme } from '../theme';
import { ENV_THEME_COLORS } from '../theme';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cameraTarget: THREE.Vector3;
  private _theme: EnvironmentTheme = 'dark';

  /** Stabilized resize handler so removeEventListener works. */
  private readonly onResizeBound = () => this.onWindowResize();

  private static readonly CAMERA_DEFAULT = { fov: 45, y: 28, z: 32 };
  /** Pull back on short layouts (phone landscape WebView uses min dimension). */
  private static readonly CAMERA_COMPACT = { fov: 52, y: 31.5, z: 36.5 };
  /** Landscape phones in hand are often shallow; widen FOV slightly. */
  private static readonly CAMERA_LANDSCAPE_SHALLOW = { fov: 54, y: 32.2, z: 37.5 };

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    const colors = ENV_THEME_COLORS.dark;
    this.scene.background = new THREE.Color(colors.sceneBg);
    this.scene.fog = new THREE.FogExp2(colors.sceneFog, 0.015);

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
    window.addEventListener('resize', this.onResizeBound);
    this.applyViewportCameraAndSize();
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

  private applyViewportCameraAndSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = h > 0 ? w / h : 1;
    const shortSide = Math.min(w, h);
    // Short min side: squat phone landscape/portrait WebViews; avoids letterboxing HUD over the board.
    const compact = shortSide < 620;
    const landscapeShallow = aspect >= 1.25 && h <= 460;
    const cam = landscapeShallow
      ? SceneManager.CAMERA_LANDSCAPE_SHALLOW
      : compact
        ? SceneManager.CAMERA_COMPACT
        : SceneManager.CAMERA_DEFAULT;
    this.camera.fov = cam.fov;
    this.camera.position.y = cam.y;
    this.camera.position.z = cam.z;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private onWindowResize() {
    this.applyViewportCameraAndSize();
  }

  /** Switch environment theme (dark/light) for accessibility. */
  public setTheme(theme: EnvironmentTheme) {
    this._theme = theme;
    const colors = ENV_THEME_COLORS[theme];
    (this.scene.background as THREE.Color).setHex(colors.sceneBg);
    (this.scene.fog as THREE.FogExp2).color.setHex(colors.sceneFog);
  }

  public update() {
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    window.removeEventListener('resize', this.onResizeBound);
    this.renderer.dispose();
  }
}
