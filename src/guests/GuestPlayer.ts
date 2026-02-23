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
    this.ballPhysics.resetStrokeCount();

    const teeWorld = this.isoMap.tileToWorld(hole.teePosition.tileX, hole.teePosition.tileY);

    // Start walking from an offset position
    this.sprite.setPosition(teeWorld.x - 80 + Math.random() * 40, teeWorld.y - 60 + Math.random() * 40);
    this.sprite.setVisible(true);

    this.targetX = teeWorld.x;
    this.targetY = teeWorld.y;
    this.state = GuestState.WALKING_TO_TEE;
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
      }

      this.aimTimer = 1500 + Math.random() * 1500;
      this.state = GuestState.AIMING;
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

      const ballPos = this.ballPhysics.getGroundPosition();
      const flagWorld = this.isoMap.tileToWorld(
        this.currentHole.flagPosition.tileX,
        this.currentHole.flagPosition.tileY,
      );

      const dist = Phaser.Math.Distance.Between(ballPos.x, ballPos.y, flagWorld.x, flagWorld.y);

      if (dist < HOLE_SINK_RADIUS || this.strokes >= MAX_GUEST_STROKES) {
        this.finishHole();
        return;
      }

      this.targetX = ballPos.x;
      this.targetY = ballPos.y;
      this.state = GuestState.WALKING_TO_BALL;
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

    // Pick club based on distance and terrain
    let clubIndex: number;
    if (tileType === TileType.GREEN || distance <= 60) {
      clubIndex = 4; // Putter
    } else if (tileType === TileType.TEE && distance > 400) {
      clubIndex = 0; // Driver
    } else if (distance > 300) {
      clubIndex = 1; // Wood
    } else if (distance > 150) {
      clubIndex = 2; // Iron
    } else {
      clubIndex = 3; // Sand Wedge
    }

    const club = CLUBS[clubIndex];

    // Angle to flag with random variance
    const baseAngle = Math.atan2(dy, dx);
    const maxVariance = tileType === TileType.GREEN ? 5 : 15;
    const variance = Phaser.Math.DegToRad((Math.random() - 0.5) * 2 * maxVariance);
    const angle = baseAngle + variance;

    // Power: 80-100% of distance, clamped to club range
    const power = Phaser.Math.Clamp(
      distance * (0.8 + Math.random() * 0.2),
      club.minPower,
      club.maxPower,
    );

    this.ballPhysics.shoot(angle, power, club.loftDegrees);
    this.strokes++;
    this.state = GuestState.BALL_FLYING;
  }

  isHoled(): boolean {
    return this.state === GuestState.HOLED;
  }

  destroy(): void {
    this.sprite?.destroy();
    this.ballPhysics?.destroy();
  }
}
