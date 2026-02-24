import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { BallPhysics } from '../systems/BallPhysics';
import { HoleData } from '../models/HoleData';
import { CLUBS } from '../models/Club';
import { TileType } from '../models/TileTypes';
import { HOLE_SINK_RADIUS } from '../utils/Constants';

const WALK_SPEED = 100;
const ARRIVE_THRESHOLD = 5;
const MAX_GUEST_STROKES = 10;

export enum GuestState {
  IDLE = 'idle',
  WALKING_TO_TEE = 'walking_to_tee',
  WAITING = 'waiting',
  AIMING = 'aiming',
  BALL_FLYING = 'ball_flying',
  WALKING_TO_BALL = 'walking_to_ball',
  HOLED = 'holed',
}

export class GuestPlayer {
  private scene: Phaser.Scene;
  private isoMap: IsometricMap;
  private sprite: Phaser.GameObjects.Sprite;
  private ballPhysics: BallPhysics;
  private state: GuestState = GuestState.IDLE;
  private currentHole: HoleData | null = null;
  private targetX = 0;
  private targetY = 0;
  private aimTimer = 0;
  private bobTimer = 0;
  private strokes = 0;
  private hasTeedOff = false;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, tint: number) {
    this.scene = scene;
    this.isoMap = isoMap;

    this.sprite = scene.add.sprite(0, 0, 'player');
    this.sprite.setTint(tint);
    this.sprite.setDepth(840);
    this.sprite.setVisible(false);

    this.ballPhysics = new BallPhysics(scene, isoMap, true);
    this.ballPhysics.createBall(0, 0);

    const ball = this.ballPhysics.getBall();
    if (ball) {
      ball.setTint(tint);
      ball.setVisible(false);
    }
  }

  startHole(hole: HoleData): void {
    this.currentHole = hole;
    this.strokes = 0;
    this.hasTeedOff = false;
    this.ballPhysics.resetStrokeCount();

    const teeWorld = this.isoMap.tileToWorld(hole.teePosition.tileX, hole.teePosition.tileY);

    this.sprite.setPosition(teeWorld.x - 80 + Math.random() * 40, teeWorld.y - 60 + Math.random() * 40);
    this.sprite.setVisible(true);

    this.targetX = teeWorld.x;
    this.targetY = teeWorld.y;
    this.state = GuestState.WALKING_TO_TEE;
  }

  /** Called by GuestPair to give this player their turn. */
  activate(): void {
    if (this.state !== GuestState.WAITING) return;

    if (!this.hasTeedOff) {
      // At tee, ready to shoot
      this.aimTimer = 1500 + Math.random() * 1500;
      this.state = GuestState.AIMING;
    } else {
      // Walk to ball, then wait again (GuestPair will activate for aiming)
      const ballPos = this.ballPhysics.getGroundPosition();
      this.targetX = ballPos.x;
      this.targetY = ballPos.y;
      this.state = GuestState.WALKING_TO_BALL;
    }
  }

  /** Called by GuestPair after player arrived at ball to start aiming. */
  startAiming(): void {
    if (this.state !== GuestState.WAITING) return;
    this.aimTimer = 1500 + Math.random() * 1500;
    this.state = GuestState.AIMING;
  }

  update(delta: number): void {
    switch (this.state) {
      case GuestState.WALKING_TO_TEE:
      case GuestState.WALKING_TO_BALL:
        this.updateWalking(delta);
        break;
      case GuestState.AIMING:
        this.updateAiming(delta);
        break;
      case GuestState.BALL_FLYING:
        this.updateBallFlying(delta);
        break;
    }
  }

  private updateWalking(delta: number): void {
    const dt = delta / 1000;
    const dx = this.targetX - this.sprite.x;
    const dy = this.targetY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVE_THRESHOLD) {
      this.sprite.setPosition(this.targetX, this.targetY);

      if (this.state === GuestState.WALKING_TO_TEE) {
        this.ballPhysics.moveBallTo(this.targetX, this.targetY);
        this.ballPhysics.getBall()?.setVisible(true);
        // Wait at tee for GuestPair to give turn
        this.state = GuestState.WAITING;
      } else {
        // Arrived at ball — start aiming immediately
        this.aimTimer = 1500 + Math.random() * 1500;
        this.state = GuestState.AIMING;
      }
      return;
    }

    const ratio = Math.min(WALK_SPEED * dt / dist, 1);
    this.sprite.setX(this.sprite.x + dx * ratio);
    this.sprite.setY(this.sprite.y + dy * ratio);
    this.sprite.setFlipX(dx < 0);

    this.bobTimer += delta;
    const bob = Math.sin(this.bobTimer * 0.008) * 2;
    this.sprite.setY(this.sprite.y + bob);
  }

  private updateAiming(delta: number): void {
    this.aimTimer -= delta;
    if (this.aimTimer <= 0) {
      this.pickClubAndShoot();
    }
  }

  private updateBallFlying(delta: number): void {
    this.ballPhysics.update(delta);

    if (this.ballPhysics.isStopped()) {
      if (!this.currentHole) {
        this.finishHole();
        return;
      }

      const dist = this.getDistanceToFlag();

      if (dist < HOLE_SINK_RADIUS || this.strokes >= MAX_GUEST_STROKES) {
        this.finishHole();
        return;
      }

      // Go to WAITING — GuestPair will decide who plays next
      this.state = GuestState.WAITING;
    }
  }

  private finishHole(): void {
    this.state = GuestState.HOLED;
    this.ballPhysics.getBall()?.setVisible(false);
    this.sprite.setVisible(false);
  }

  private pickClubAndShoot(): void {
    if (!this.currentHole) return;

    const ballPos = this.ballPhysics.getGroundPosition();
    const flagWorld = this.isoMap.tileToWorld(
      this.currentHole.flagPosition.tileX,
      this.currentHole.flagPosition.tileY,
    );

    const dx = flagWorld.x - ballPos.x;
    const dy = flagWorld.y - ballPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const ballTile = this.isoMap.worldToTile(ballPos.x, ballPos.y);
    const tileType = this.isoMap.getTileAt(ballTile.tileX, ballTile.tileY);

    let clubIndex: number;
    if (tileType === TileType.GREEN || distance <= 60) {
      clubIndex = 4;
    } else if (tileType === TileType.TEE && distance > 400) {
      clubIndex = 0;
    } else if (distance > 300) {
      clubIndex = 1;
    } else if (distance > 150) {
      clubIndex = 2;
    } else {
      clubIndex = 3;
    }

    const club = CLUBS[clubIndex];
    const baseAngle = Math.atan2(dy, dx);
    const maxVariance = tileType === TileType.GREEN ? 5 : 15;
    const variance = Phaser.Math.DegToRad((Math.random() - 0.5) * 2 * maxVariance);
    const angle = baseAngle + variance;

    const power = Phaser.Math.Clamp(
      distance * (0.8 + Math.random() * 0.2),
      club.minPower,
      club.maxPower,
    );

    this.ballPhysics.shoot(angle, power, club.loftDegrees);
    this.strokes++;
    this.hasTeedOff = true;
    this.state = GuestState.BALL_FLYING;
  }

  /** Distance from ball to flag (used by GuestPair for turn order). */
  getDistanceToFlag(): number {
    if (!this.currentHole) return 0;
    const ballPos = this.ballPhysics.getGroundPosition();
    const flagWorld = this.isoMap.tileToWorld(
      this.currentHole.flagPosition.tileX,
      this.currentHole.flagPosition.tileY,
    );
    return Phaser.Math.Distance.Between(ballPos.x, ballPos.y, flagWorld.x, flagWorld.y);
  }

  getStrokes(): number {
    return this.strokes;
  }

  isHoled(): boolean {
    return this.state === GuestState.HOLED;
  }

  isWaiting(): boolean {
    return this.state === GuestState.WAITING;
  }

  isBallFlying(): boolean {
    return this.state === GuestState.BALL_FLYING;
  }

  needsTeeShot(): boolean {
    return !this.hasTeedOff;
  }

  destroy(): void {
    this.sprite?.destroy();
    this.ballPhysics?.destroy();
  }
}
