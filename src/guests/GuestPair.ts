import { IsometricMap } from '../systems/IsometricMap';
import { GuestPlayer } from './GuestPlayer';
import { HoleData } from '../models/HoleData';

export class GuestPair {
  private playerA: GuestPlayer;
  private playerB: GuestPlayer;
  private holes: HoleData[];
  private currentHoleIndex: number;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, tint: number, holes: HoleData[], startHoleIndex: number) {
    this.holes = holes;
    this.currentHoleIndex = startHoleIndex % holes.length;

    // Two guests with slightly different tints
    this.playerA = new GuestPlayer(scene, isoMap, tint);
    this.playerB = new GuestPlayer(scene, isoMap, this.lightenTint(tint));

    this.startCurrentHole();
  }

  private lightenTint(tint: number): number {
    const r = Math.min(255, ((tint >> 16) & 0xff) + 40);
    const g = Math.min(255, ((tint >> 8) & 0xff) + 40);
    const b = Math.min(255, (tint & 0xff) + 40);
    return (r << 16) | (g << 8) | b;
  }

  private startCurrentHole(): void {
    const hole = this.holes[this.currentHoleIndex];
    this.playerA.startHole(hole);
    this.playerB.startHole(hole);
  }

  update(delta: number): void {
    this.playerA.update(delta);
    this.playerB.update(delta);

    // Both holed → advance to next hole
    if (this.playerA.isHoled() && this.playerB.isHoled()) {
      this.currentHoleIndex = (this.currentHoleIndex + 1) % this.holes.length;
      this.startCurrentHole();
    }
  }

  destroy(): void {
    this.playerA.destroy();
    this.playerB.destroy();
  }
}
