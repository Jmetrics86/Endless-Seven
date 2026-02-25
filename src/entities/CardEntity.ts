/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CardData, Alignment } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { GameEntity } from '../engine/EntityManager';

export class CardEntity implements GameEntity {
  public mesh: THREE.Group;
  public data: CardData & { 
    isEnemy: boolean; 
    faceUp: boolean; 
    powerMarkers: number; 
    weaknessMarkers: number;
    isInvincible: boolean;
    isSuppressed: boolean;
  };

  private pCanvas: HTMLCanvasElement;
  private pTex: THREE.CanvasTexture;
  private wCanvas: HTMLCanvasElement;
  private wTex: THREE.CanvasTexture;
  private tCanvas: HTMLCanvasElement;
  private tTex: THREE.CanvasTexture;
  private nCanvas: HTMLCanvasElement;
  private nTex: THREE.CanvasTexture;

  private pMesh: THREE.Mesh;
  private wMesh: THREE.Mesh;
  private tMesh: THREE.Mesh;
  private nMesh: THREE.Mesh;

  constructor(data: CardData, isEnemy: boolean, playerAlignment: Alignment) {
    this.data = {
      ...data,
      isEnemy,
      faceUp: false,
      powerMarkers: 0,
      weaknessMarkers: 0,
      isInvincible: false,
      isSuppressed: false
    };

    this.mesh = new THREE.Group();
    const color = isEnemy 
      ? (playerAlignment === Alignment.LIGHT ? 0x551111 : 0x113366) 
      : (playerAlignment === Alignment.LIGHT ? 0x113366 : 0x551111);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(GAME_CONSTANTS.CARD_W, 0.1, GAME_CONSTANTS.CARD_H),
      new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: isEnemy ? 0.3 : 0.8 })
    );
    this.mesh.add(body);

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

    const tex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONSTANTS.CARD_W * 0.95, GAME_CONSTANTS.CARD_H * 0.95),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.08;
    this.mesh.add(label);

    // Markers
    this.pCanvas = document.createElement('canvas');
    this.pCanvas.width = 128;
    this.pCanvas.height = 128;
    this.pTex = new THREE.CanvasTexture(this.pCanvas);
    this.pMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: this.pTex, transparent: true }));
    this.pMesh.rotation.x = -Math.PI / 2;
    this.pMesh.position.set(-0.7, 0.09, 1.2);
    this.mesh.add(this.pMesh);

    this.wCanvas = document.createElement('canvas');
    this.wCanvas.width = 128;
    this.wCanvas.height = 128;
    this.wTex = new THREE.CanvasTexture(this.wCanvas);
    this.wMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: this.wTex, transparent: true }));
    this.wMesh.rotation.x = -Math.PI / 2;
    this.wMesh.position.set(0.7, 0.09, 1.2);
    this.mesh.add(this.wMesh);

    this.tCanvas = document.createElement('canvas');
    this.tCanvas.width = 128;
    this.tCanvas.height = 128;
    this.tTex = new THREE.CanvasTexture(this.tCanvas);
    this.tMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: this.tTex, transparent: true }));
    this.tMesh.rotation.x = -Math.PI / 2;
    this.tMesh.position.set(0, 0.09, 1.2);
    this.mesh.add(this.tMesh);

    this.nCanvas = document.createElement('canvas');
    this.nCanvas.width = 128;
    this.nCanvas.height = 128;
    this.nTex = new THREE.CanvasTexture(this.nCanvas);
    this.nMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: this.nTex, transparent: true }));
    this.nMesh.rotation.x = -Math.PI / 2;
    this.nMesh.position.set(0, 0.1, -1.2); // Top middle
    this.mesh.add(this.nMesh);

    this.updateVisualMarkers();
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
  }

  public update(time: number) {
    const body = this.mesh.children[0] as THREE.Mesh;
    const material = body.material as THREE.MeshPhongMaterial;
    if (this.data.faceUp) {
      material.emissiveIntensity = 0.8 + Math.sin(time * 4) * 0.4;
    } else {
      material.emissiveIntensity = 0.3 + Math.sin(time * 2) * 0.1;
    }
  }

  public dispose() {
    this.pTex.dispose();
    this.wTex.dispose();
    this.tTex.dispose();
    this.nTex.dispose();
    this.mesh.clear();
  }
}
