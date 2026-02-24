import { IsometricMap } from '../systems/IsometricMap';
import { GuestPlayer } from './GuestPlayer';
import { HoleData } from '../models/HoleData';
import { MatchScoreSheet, HoleScore, createEmptyScoreSheet } from '../models/MatchScoreSheet';

enum PairPhase {
  WALKING_TO_TEE,
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
  private holeCompleteTimer = 0;
  private scoreSheet: MatchScoreSheet = createEmptyScoreSheet();

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
  }

  update(delta: number): void {
    this.playerA.update(delta);
    this.playerB.update(delta);

    switch (this.phase) {
      case PairPhase.WALKING_TO_TEE:
        this.updateWalkingToTee();
        break;
      case PairPhase.TURN_PLAY:
        this.updateTurnPlay();
        break;
      case PairPhase.HOLE_COMPLETE:
        this.updateHoleComplete(delta);
        break;
    }
  }

  /** Both players walk to tee. When both arrive, transition to turn play. */
  private updateWalkingToTee(): void {
    if (this.playerA.isWaiting() && this.playerB.isWaiting()) {
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

    // Wait until both players are either WAITING or HOLED (nobody aiming/walking/flying)
    const aBusy = !this.playerA.isWaiting() && !this.playerA.isHoled();
    const bBusy = !this.playerB.isWaiting() && !this.playerB.isHoled();
    if (aBusy || bBusy) return;

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
    const hole = this.holes[this.currentHoleIndex];
    const strokesA = this.playerA.getStrokes();
    const strokesB = this.playerB.getStrokes();
    const scoreA = strokesA - hole.par;
    const scoreB = strokesB - hole.par;

    let winner: 'A' | 'B' | 'tie';
    if (strokesA < strokesB) {
      winner = 'A';
      this.scoreSheet.holesWonA++;
    } else if (strokesB < strokesA) {
      winner = 'B';
      this.scoreSheet.holesWonB++;
    } else {
      winner = 'tie';
      this.scoreSheet.tiedHoles++;
    }

    const holeScore: HoleScore = {
      holeIndex: this.currentHoleIndex,
      par: hole.par,
      strokesA,
      strokesB,
      scoreA,
      scoreB,
      winner,
    };

    this.scoreSheet.holeScores.push(holeScore);
    this.scoreSheet.totalStrokesA += strokesA;
    this.scoreSheet.totalStrokesB += strokesB;
    this.scoreSheet.totalScoreA += scoreA;
    this.scoreSheet.totalScoreB += scoreB;
  }

  getScoreSheet(): MatchScoreSheet {
    return this.scoreSheet;
  }

  destroy(): void {
    this.playerA.destroy();
    this.playerB.destroy();
  }
}
