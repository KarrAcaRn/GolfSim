import { IsometricMap } from '../systems/IsometricMap';
import { GuestPlayer } from './GuestPlayer';
import { HoleData } from '../models/HoleData';

interface HoleResult {
  strokesA: number;
  strokesB: number;
  winner: 'A' | 'B' | 'tie';
}

export interface MatchResult {
  holeResults: HoleResult[];
  winsA: number;
  winsB: number;
  ties: number;
}

enum PairPhase {
  WALKING_TO_TEE,
  TEE_SHOTS,
  TURN_PLAY,
  HOLE_COMPLETE,
}

const HOLE_COMPLETE_DELAY = 1500;

export class GuestPair {
  private playerA: GuestPlayer;
  private playerB: GuestPlayer;
  private holes: HoleData[];
  private currentHoleIndex: number;
  private phase: PairPhase = PairPhase.WALKING_TO_TEE;
  private teeOrder: 'A' | 'B' = 'A';
  private holeCompleteTimer = 0;
  private matchResult: MatchResult = { holeResults: [], winsA: 0, winsB: 0, ties: 0 };

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, tint: number, holes: HoleData[], startHoleIndex: number) {
    this.holes = holes;
    this.currentHoleIndex = startHoleIndex % holes.length;

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
    this.phase = PairPhase.WALKING_TO_TEE;
    this.teeOrder = 'A';
  }

  update(delta: number): void {
    this.playerA.update(delta);
    this.playerB.update(delta);

    switch (this.phase) {
      case PairPhase.WALKING_TO_TEE:
        this.updateWalkingToTee();
        break;
      case PairPhase.TEE_SHOTS:
        this.updateTeeShots();
        break;
      case PairPhase.TURN_PLAY:
        this.updateTurnPlay();
        break;
      case PairPhase.HOLE_COMPLETE:
        this.updateHoleComplete(delta);
        break;
    }
  }

  /** Both players walk to tee. When both arrive (WAITING), first player tees off. */
  private updateWalkingToTee(): void {
    if (this.playerA.isWaiting() && this.playerB.isWaiting()) {
      // Both at tee — first player starts aiming
      if (this.teeOrder === 'A') {
        this.playerA.activate();
      } else {
        this.playerB.activate();
      }
      this.phase = PairPhase.TEE_SHOTS;
    }
  }

  /** Tee shots: A shoots, then B shoots (or vice versa). */
  private updateTeeShots(): void {
    const first = this.teeOrder === 'A' ? this.playerA : this.playerB;
    const second = this.teeOrder === 'A' ? this.playerB : this.playerA;

    // If a ball is in flight, wait
    if (first.isBallFlying() || second.isBallFlying()) return;

    if (first.isWaiting() && second.needsTeeShot()) {
      // First player's ball landed — second player tees off
      second.activate();
      return;
    }

    if (first.isWaiting() && second.isWaiting() && !first.needsTeeShot() && !second.needsTeeShot()) {
      // Both tee shots done — transition to turn play
      this.phase = PairPhase.TURN_PLAY;
      this.activateNextPlayer();
    }
  }

  /** Turn-based play: farthest from hole plays next. */
  private updateTurnPlay(): void {
    // Check if both holed
    if (this.playerA.isHoled() && this.playerB.isHoled()) {
      this.recordHoleResult();
      this.holeCompleteTimer = HOLE_COMPLETE_DELAY;
      this.phase = PairPhase.HOLE_COMPLETE;
      return;
    }

    // If a ball is in flight, wait
    if (this.playerA.isBallFlying() || this.playerB.isBallFlying()) return;

    // If someone just finished their shot (WAITING) and needs to be activated
    this.activateNextPlayer();
  }

  /** Activate the player farthest from the hole (if they're waiting). */
  private activateNextPlayer(): void {
    const aWaiting = this.playerA.isWaiting() && !this.playerA.isHoled();
    const bWaiting = this.playerB.isWaiting() && !this.playerB.isHoled();

    // If only one is waiting (other is holed or walking), activate the waiting one
    if (aWaiting && !bWaiting) {
      this.playerA.activate();
      return;
    }
    if (bWaiting && !aWaiting) {
      this.playerB.activate();
      return;
    }

    // Both waiting — farthest from hole plays first
    if (aWaiting && bWaiting) {
      const distA = this.playerA.getDistanceToFlag();
      const distB = this.playerB.getDistanceToFlag();
      if (distA >= distB) {
        this.playerA.activate();
      } else {
        this.playerB.activate();
      }
    }
  }

  /** Short pause after hole complete, then advance. */
  private updateHoleComplete(delta: number): void {
    this.holeCompleteTimer -= delta;
    if (this.holeCompleteTimer <= 0) {
      this.currentHoleIndex = (this.currentHoleIndex + 1) % this.holes.length;
      this.startCurrentHole();
    }
  }

  private recordHoleResult(): void {
    const strokesA = this.playerA.getStrokes();
    const strokesB = this.playerB.getStrokes();
    let winner: 'A' | 'B' | 'tie';
    if (strokesA < strokesB) {
      winner = 'A';
      this.matchResult.winsA++;
    } else if (strokesB < strokesA) {
      winner = 'B';
      this.matchResult.winsB++;
    } else {
      winner = 'tie';
      this.matchResult.ties++;
    }
    this.matchResult.holeResults.push({ strokesA, strokesB, winner });
  }

  getMatchResult(): MatchResult {
    return this.matchResult;
  }

  destroy(): void {
    this.playerA.destroy();
    this.playerB.destroy();
  }
}
