/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { CardData, Alignment } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { GameEntity } from '../engine/EntityManager';
import { CARD_ART_PATHS, CARD_BACK_PATH, cardArtUrl } from '../cardArtPaths';

/** Resolved back texture; also used so update() can apply even if the one-time .then() missed. */
let sharedBackTexture: THREE.Texture | null = null;
/** Single Promise for card back texture so all cards wait for one load (no race). */
let backTextureLoadPromise: Promise<THREE.Texture> | null = null;
/**
 * Face texture cache: one Promise per URL so cards that need the same art while it's still loading
 * wait for the same request instead of getting undefined or starting a duplicate load.
 */
const faceTextureLoadPromises: Record<string, Promise<THREE.Texture>> = {};

/** Scratch: mesh local +Y axis in world space (for hover lift sign vs table). */
const _scratchLocalYWorld = new THREE.Vector3();
/** Resolved face textures by URL so update() can retry applying if the one-time .then() missed. */
const faceTextureResolvedCache: Record<string, THREE.Texture> = {};

function getOrLoadFaceTexture(url: string): Promise<THREE.Texture> {
  if (faceTextureLoadPromises[url]) return faceTextureLoadPromises[url];
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      faceTextureResolvedCache[url] = tex;
      resolve(tex);
    }, undefined, reject);
  });
  faceTextureLoadPromises[url] = promise;
  return promise;
}

/** Preload card back texture; call before creating hand cards so the first (leftmost) card gets the texture. */
export function getOrLoadBackTexture(): Promise<THREE.Texture> {
  if (sharedBackTexture) return Promise.resolve(sharedBackTexture);
  if (backTextureLoadPromise) return backTextureLoadPromise;
  backTextureLoadPromise = new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    const url = cardArtUrl(CARD_BACK_PATH);
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      sharedBackTexture = tex;
      resolve(tex);
    }, undefined, reject);
  });
  return backTextureLoadPromise;
}

export class CardEntity implements GameEntity {
  public mesh: THREE.Group;
  public data: CardData & {
    isEnemy: boolean;
    faceUp: boolean;
    powerMarkers: number;
    weaknessMarkers: number;
    isInvincible: boolean;
    isSuppressed: boolean;
    markedByWildWolf?: boolean;
    pendingDeltaSacrifice?: boolean;
    markedForDeltaBuff?: boolean;
    /** True while this card is resolving a non-flip ability (Activate, etc.). */
    isActivatingAbility?: boolean;
    /**
     * Subtotal of powerMarkers from "count matching types / faction in play" (Spinner, Omega, Hades).
     * Kept in sync by AbilityManager.syncBoardPresencePowerMarkers so totals do not stack incorrectly.
     */
    boardPresencePowerMarkers?: number;
  };

  private pCanvas: HTMLCanvasElement;
  private pTex: THREE.CanvasTexture;
  private wCanvas: HTMLCanvasElement;
  private wTex: THREE.CanvasTexture;
  private tCanvas: HTMLCanvasElement;
  private tTex: THREE.CanvasTexture;
  private nCanvas: HTMLCanvasElement;
  private nTex: THREE.CanvasTexture;
  private xCanvas: HTMLCanvasElement;
  private xTex: THREE.CanvasTexture;

  private pMesh: THREE.Mesh;
  private wMesh: THREE.Mesh;
  private tMesh: THREE.Mesh;
  private nMesh: THREE.Mesh;
  private xMesh: THREE.Mesh;

  /** Base emissive color used when not highlighting ability activation. */
  private baseEmissiveColor: THREE.Color;

  /** Rectangular halo on the table when this card is activating a non-flip ability. */
  private abilityHalo: THREE.Mesh;

  /** Main card box mesh (for emissive pulse in update). */
  private bodyMesh: THREE.Mesh;

  /**
   * Child of mesh: all card visuals live here so hover lift tweens this group's local Y
   * without fighting gameplay tweens on mesh.position.
   */
  private visualLiftRoot: THREE.Group;

  /** Face label mesh (top of card); material.map may be replaced when art loads. */
  private faceLabel: THREE.Mesh;
  /** Back plane (bottom of card); shows when card is face down. */
  private backPlane: THREE.Mesh;
  private defaultFaceTex: THREE.CanvasTexture;

  constructor(data: CardData, isEnemy: boolean, playerAlignment: Alignment) {
    this.data = {
      ...data,
      isEnemy,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isInvincible: false,
      isSuppressed: false,
      markedByWildWolf: false,
      pendingDeltaSacrifice: false,
      markedForDeltaBuff: false,
      isActivatingAbility: false
    };

    this.mesh = new THREE.Group();
    this.visualLiftRoot = new THREE.Group();
    this.mesh.add(this.visualLiftRoot);

    const color = isEnemy 
      ? (playerAlignment === Alignment.LIGHT ? 0x551111 : 0x113366) 
      : (playerAlignment === Alignment.LIGHT ? 0x113366 : 0x551111);

    this.baseEmissiveColor = new THREE.Color(color);

    this.bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(GAME_CONSTANTS.CARD_W, 0.1, GAME_CONSTANTS.CARD_H),
      new THREE.MeshPhongMaterial({
        color,
        emissive: this.baseEmissiveColor,
        emissiveIntensity: isEnemy ? 0.3 : 0.8
      })
    );
    this.visualLiftRoot.add(this.bodyMesh);

    // Main Card Face
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isEnemy ? '#200' : '#002';
    ctx.fillRect(0, 0, 256, 384);
    ctx.strokeStyle = isEnemy ? '#f66' : '#6ff';
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, 256, 384);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(data.name.toUpperCase(), 128, 50);
    ctx.font = '14px Cinzel';
    ctx.fillStyle = isEnemy ? '#f88' : '#8ff';
    ctx.fillText(data.faction, 128, 75);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 100px Cinzel';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(data.power.toString(), 128, 220);
    ctx.font = 'bold 30px Cinzel';
    ctx.fillText(data.isChampion ? 'CHAMPION' : data.type.toUpperCase(), 128, 310);

    this.defaultFaceTex = new THREE.CanvasTexture(canvas);
    this.faceLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W * 0.95, GAME_CONSTANTS.CARD_H * 0.95),
      new THREE.MeshBasicMaterial({
        map: this.defaultFaceTex,
        transparent: true,
        color: 0xffffff
      })
    );
    this.faceLabel.rotation.x = -Math.PI / 2;
    this.faceLabel.position.y = 0.08;
    this.visualLiftRoot.add(this.faceLabel);

    // Card back plane (visible when face-down); use Promise so all cards wait for one load (no race)
    const backGeo = new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W * 0.95, GAME_CONSTANTS.CARD_H * 0.95);
    const backMat = new THREE.MeshBasicMaterial({
      map: sharedBackTexture ?? undefined,
      transparent: true
    });
    this.backPlane = new THREE.Mesh(backGeo, backMat);
    this.backPlane.rotation.x = Math.PI / 2;
    this.backPlane.position.y = -0.08;
    this.visualLiftRoot.add(this.backPlane);
    // Kick off load so sharedBackTexture is set when ready. Apply only in update() so the first
    // card (leftmost) gets the texture the same way as the rest — applying in .then() here can
    // leave the first card gray because it runs before the mesh is fully in the scene.
    getOrLoadBackTexture().catch(() => {});
    if (sharedBackTexture) backMat.map = sharedBackTexture;

    // Load face art if available; use promise cache so cards requesting same URL while loading wait for one request
    const facePath = CARD_ART_PATHS[data.name];
    if (facePath) {
      const url = cardArtUrl(facePath);
      const faceMat = this.faceLabel.material as THREE.MeshBasicMaterial;
      getOrLoadFaceTexture(url).then((tex) => {
        if (faceMat && faceMat.map === this.defaultFaceTex) faceMat.map = tex;
      }).catch(() => {
        // On error keep canvas fallback
      });
    }

    // Markers
    this.pCanvas = document.createElement('canvas');
    this.pCanvas.width = 128;
    this.pCanvas.height = 128;
    this.pTex = new THREE.CanvasTexture(this.pCanvas);
    this.pMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: this.pTex, transparent: true }));
    this.pMesh.rotation.x = -Math.PI / 2;
    this.pMesh.position.set(-0.7, 0.09, 1.2);
    this.visualLiftRoot.add(this.pMesh);

    this.wCanvas = document.createElement('canvas');
    this.wCanvas.width = 128;
    this.wCanvas.height = 128;
    this.wTex = new THREE.CanvasTexture(this.wCanvas);
    this.wMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: this.wTex, transparent: true }));
    this.wMesh.rotation.x = -Math.PI / 2;
    this.wMesh.position.set(0.7, 0.09, 1.2);
    this.visualLiftRoot.add(this.wMesh);

    this.tCanvas = document.createElement('canvas');
    this.tCanvas.width = 128;
    this.tCanvas.height = 128;
    this.tTex = new THREE.CanvasTexture(this.tCanvas);
    this.tMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: this.tTex, transparent: true }));
    this.tMesh.rotation.x = -Math.PI / 2;
    this.tMesh.position.set(0, 0.09, 1.2);
    this.visualLiftRoot.add(this.tMesh);

    this.nCanvas = document.createElement('canvas');
    this.nCanvas.width = 128;
    this.nCanvas.height = 128;
    this.nTex = new THREE.CanvasTexture(this.nCanvas);
    this.nMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: this.nTex, transparent: true }));
    this.nMesh.rotation.x = -Math.PI / 2;
    this.nMesh.position.set(0, 0.1, -1.2); // Top middle
    this.visualLiftRoot.add(this.nMesh);

    // Wild Wolf death marker (black X)
    this.xCanvas = document.createElement('canvas');
    this.xCanvas.width = 128;
    this.xCanvas.height = 128;
    this.xTex = new THREE.CanvasTexture(this.xCanvas);
    this.xMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: this.xTex, transparent: true }));
    this.xMesh.rotation.x = -Math.PI / 2;
    this.xMesh.position.set(0, 0.12, 0);
    this.visualLiftRoot.add(this.xMesh);

    this.updateVisualMarkers();

    // Ability activation: rectangle on table (card-shaped) + vertical beam up
    const haloGeo = new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W * 1.08, GAME_CONSTANTS.CARD_H * 1.08);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    this.abilityHalo = new THREE.Mesh(haloGeo, haloMat);
    this.abilityHalo.rotation.x = -Math.PI / 2;
    this.abilityHalo.position.set(0, 0.13, 0);
    this.abilityHalo.visible = false;
    this.visualLiftRoot.add(this.abilityHalo);
  }

  /**
   * Current visual hover offset on the inner lift group (for syncing when rotation changes mid-hover).
   */
  public getVisualLiftLocalY(): number {
    return this.visualLiftRoot.position.y;
  }

  /**
   * Whether positive `visualLiftRoot.position.y` moves the card toward world +Y (sky).
   * Uses live mesh rotation so it stays correct during flip tweens and haste “reveal without faceUp” windows.
   */
  public getHoverLiftWorldUpSign(): number {
    _scratchLocalYWorld.set(0, 1, 0).applyQuaternion(this.mesh.quaternion);
    const wy = _scratchLocalYWorld.y;
    if (wy > 0.02) return 1;
    if (wy < -0.02) return -1;
    return this.data.faceUp ? 1 : -1;
  }

  /** Animate local Y lift for hover (does not touch mesh.position). */
  public tweenHoverLift(localY: number, duration: number, ease: string = 'power2.out') {
    gsap.killTweensOf(this.visualLiftRoot.position);
    gsap.to(this.visualLiftRoot.position, { y: localY, duration, ease });
  }

  /** Return hover lift to neutral. */
  public resetHoverLift(duration: number = 0.28, ease: string = 'power2.out') {
    gsap.killTweensOf(this.visualLiftRoot.position);
    gsap.to(this.visualLiftRoot.position, { y: 0, duration, ease });
  }

  public updateVisualMarkers() {
    const effPow = this.data.power + this.data.powerMarkers - this.data.weaknessMarkers;

    const pCtx = this.pCanvas.getContext('2d')!;
    pCtx.clearRect(0, 0, 128, 128);
    if (this.data.powerMarkers > 0) {
      pCtx.fillStyle = '#00f2ff';
      pCtx.font = 'bold 80px Arial';
      pCtx.textAlign = 'center';
      pCtx.fillText("+" + this.data.powerMarkers, 64, 90);
      this.pMesh.visible = true;
    } else this.pMesh.visible = false;
    this.pTex.needsUpdate = true;

    const wCtx = this.wCanvas.getContext('2d')!;
    wCtx.clearRect(0, 0, 128, 128);
    if (this.data.weaknessMarkers > 0) {
      wCtx.fillStyle = '#ff0044';
      wCtx.font = 'bold 80px Arial';
      wCtx.textAlign = 'center';
      wCtx.fillText("-" + this.data.weaknessMarkers, 64, 90);
      this.wMesh.visible = true;
    } else this.wMesh.visible = false;
    this.wTex.needsUpdate = true;

    const tCtx = this.tCanvas.getContext('2d')!;
    tCtx.clearRect(0, 0, 128, 128);
    tCtx.fillStyle = '#ffffff';
    tCtx.font = 'bold 85px Cinzel';
    tCtx.textAlign = 'center';
    tCtx.strokeStyle = '#000';
    tCtx.lineWidth = 4;
    tCtx.strokeText(effPow.toString(), 64, 90);
    tCtx.fillText(effPow.toString(), 64, 90);
    this.tTex.needsUpdate = true;

    const nCtx = this.nCanvas.getContext('2d')!;
    nCtx.clearRect(0, 0, 128, 128);
    if (this.data.isSuppressed) {
      nCtx.fillStyle = '#888888';
      nCtx.beginPath();
      nCtx.arc(64, 64, 50, 0, Math.PI * 2);
      nCtx.fill();
      nCtx.strokeStyle = '#ffffff';
      nCtx.lineWidth = 10;
      nCtx.stroke();
      nCtx.fillStyle = 'white';
      nCtx.font = 'bold 80px Arial';
      nCtx.textAlign = 'center';
      nCtx.fillText("Ø", 64, 92);
      this.nMesh.visible = true;
    } else {
      this.nMesh.visible = false;
    }
    this.nTex.needsUpdate = true;

    // Wild Wolf death marker: black X (destroyed at end of round)
    const xCtx = this.xCanvas.getContext('2d')!;
    xCtx.clearRect(0, 0, 128, 128);
    if (this.data.markedByWildWolf) {
      xCtx.strokeStyle = '#000000';
      xCtx.lineWidth = 16;
      xCtx.lineCap = 'round';
      xCtx.beginPath();
      xCtx.moveTo(12, 12);
      xCtx.lineTo(116, 116);
      xCtx.moveTo(116, 12);
      xCtx.lineTo(12, 116);
      xCtx.stroke();
      this.xMesh.visible = true;
    } else {
      this.xMesh.visible = false;
    }
    this.xTex.needsUpdate = true;
  }

  public update(time: number) {
    const material = this.bodyMesh.material as THREE.MeshPhongMaterial;
    if (this.data.isActivatingAbility) {
      // Strong white emissive + pulsing scale + rectangular halo
      material.emissive.set(0xffffff);
      material.emissiveIntensity = 1.8 + Math.sin(time * 10) * 0.7;

      const pulse = 1.05 + Math.sin(time * 8) * 0.03;
      this.mesh.scale.set(pulse, 1, pulse);

      const haloMat = this.abilityHalo.material as THREE.MeshBasicMaterial;
      this.abilityHalo.visible = true;
      haloMat.opacity = 0.65 + Math.sin(time * 8) * 0.25;
    } else {
      // Restore base visuals
      material.emissive.copy(this.baseEmissiveColor);
      this.mesh.scale.set(1, 1, 1);
      this.abilityHalo.visible = false;

      if (this.data.faceUp) {
        material.emissiveIntensity = 0.8 + Math.sin(time * 4) * 0.4;
      } else {
        material.emissiveIntensity = 0.3 + Math.sin(time * 2) * 0.1;
      }
    }
    // Ensure back texture is applied if it loaded after this card was created (fixes missed cards e.g. Sloth)
    this.applyBackTextureIfNeeded();
    // Retry applying face texture from cache if the one-time .then() didn't run (fixes one random gray card)
    this.applyFaceTextureIfReady();
  }

  /** If our face art has loaded, apply it; avoids relying only on the initial .then() which can miss. */
  private applyFaceTextureIfReady(): void {
    const facePath = CARD_ART_PATHS[this.data.name];
    if (!facePath) return;
    const url = cardArtUrl(facePath);
    const tex = faceTextureResolvedCache[url];
    if (!tex) return;
    const faceMat = this.faceLabel.material as THREE.MeshBasicMaterial;
    if (faceMat.map !== tex) {
      faceMat.map = tex;
    }
  }

  /** Apply back texture when ready; runs every update() so we never miss (fixes one random gray card back). */
  public applyBackTextureIfNeeded(): void {
    if (!sharedBackTexture) return;
    const backMat = this.backPlane.material as THREE.MeshBasicMaterial;
    if (backMat.map !== sharedBackTexture) {
      backMat.map = sharedBackTexture;
    }
  }

  /** Set opacity on all card materials so card can fade during animations. */
  public setOpacity(value: number): void {
    this.mesh.traverse((obj) => {
      const maybeMat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!maybeMat) return;

      const setMat = (m: any) => {
        if (typeof m.opacity === 'number') {
          m.transparent = true;
          m.opacity = value;
        }
      };

      if (Array.isArray(maybeMat)) {
        maybeMat.forEach(setMat);
      } else {
        setMat(maybeMat);
      }
    });
  }

  public dispose() {
    this.pTex.dispose();
    this.wTex.dispose();
    this.tTex.dispose();
    this.nTex.dispose();
    this.xTex.dispose();
    this.mesh.clear();
  }
}
