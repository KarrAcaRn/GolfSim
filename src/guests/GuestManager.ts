import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { GuestPair } from './GuestPair';
import { HoleData } from '../models/HoleData';

const PAIR_TINTS = [0xff8888, 0x8888ff];

export class GuestManager {
  private pairs: GuestPair[] = [];
  private scene: Phaser.Scene;
  private isoMap: IsometricMap;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap) {
    this.scene = scene;
    this.isoMap = isoMap;
  }

  start(holes: HoleData[]): void {
    this.stop();
    if (holes.length === 0) return;

    const startHole2 = holes.length > 1 ? 1 : 0;
    this.pairs.push(new GuestPair(this.scene, this.isoMap, PAIR_TINTS[0], holes, 0));
    this.pairs.push(new GuestPair(this.scene, this.isoMap, PAIR_TINTS[1], holes, startHole2));
  }

  stop(): void {
    for (const pair of this.pairs) {
      pair.destroy();
    }
    this.pairs = [];
  }

  update(delta: number): void {
    for (const pair of this.pairs) {
      pair.update(delta);
    }
  }

  destroy(): void {
    this.stop();
  }
}
