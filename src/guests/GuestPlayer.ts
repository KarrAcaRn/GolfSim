import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { BallPhysics } from '../systems/BallPhysics';
import { HoleData } from '../models/HoleData';
import { CLUBS } from '../models/Club';
import { TileType } from '../models/TileTypes';
import { GuestSkills } from '../models/GuestSkills';
import { HOLE_SINK_RADIUS } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

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
  private skills: GuestSkills;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, tint: number, skills: GuestSkills) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.skills = skills;

    this.sprite = scene.add.sprite(0, 0, 'player');
    this.sprite.setTint(tint);
    this.sprite.setDepth(840);
    this.sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.sprite.on('pointerdown', () => {
      EventBus.emit('guest-selected', this.skills);
    });
    this.sprite.setVisible(false);

    this.ballPhysics = new BallPhysics(scene, isoMap, true);
    this.ballPhysics.createBall(0, 0);

    const ball = this.ballPhysics.getBall();
    if (ball) {
      ball.setTint(tint);
      ball.setVisible(false);
    }
  }

  getSkills(): GuestSkills {
    return this.skills;
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

  /** Called by GuestPair to give this player their turn (start aiming). */
  activate(): void {
    if (this.state !== GuestState.WAITING) return;
    this.aimTimer = 1500 + Math.random() * 1500;
    this.state = GuestState.AIMING;
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
        // Arrived at ball — wait for GuestPair to activate aiming
        this.state = GuestState.WAITING;
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

      // Auto-walk to ball and wait there
      const ballPos = this.ballPhysics.getGroundPosition();
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
    const baseAngle = Math.atan2(dy, dx);

    const ballTile = this.isoMap.worldToTile(ballPos.x, ballPos.y);
    const tileType = this.isoMap.getTileAt(ballTile.tileX, ballTile.tileY);

    // --- Evaluate all club + power combos via trajectory simulation ---
    let bestClubIndex = 2;
    let bestPower = 100;
    let bestScore = -Infinity;

    for (let ci = 0; ci < CLUBS.length; ci++) {
      const club = CLUBS[ci];

      // Skip driver if not on tee
      if (club.teeOnly && tileType !== TileType.TEE) continue;

      // Skill-based ideal power range: better skill = more of the club's range usable
      const clubSkill = this.getClubSkill(club.id);
      const skillFactor = clubSkill / 100;
      const idealMid = club.minPower + (club.maxPower - club.minPower) * (0.4 + 0.3 * skillFactor);

      const steps = 100;
      for (let s = 0; s <= steps; s++) {
        const power = club.minPower + (club.maxPower - club.minPower) * (s / steps);

        // Simulate trajectory to find actual landing position
        const points = this.ballPhysics.simulateTrajectory(
          ballPos.x, ballPos.y, baseAngle, power, club.loftDegrees, 0, 0
        );
        if (points.length === 0) continue;

        const lastPt = points[points.length - 1];
        const landDist = Phaser.Math.Distance.Between(lastPt.x, lastPt.y, flagWorld.x, flagWorld.y);

        // Landing terrain score
        const landTile = this.isoMap.worldToTile(lastPt.x, lastPt.y);
        const landTerrain = this.isoMap.getTileAt(landTile.tileX, landTile.tileY);
        const terrainBonus = this.landingTerrainScore(landTerrain) * 40;

        // Distance penalty (closer to flag = better)
        const distScore = -landDist;

        // Prefer power near skill-based ideal (player is most consistent there)
        const idealDev = Math.abs(power - idealMid) / (club.maxPower - club.minPower);
        const idealBonus = (1 - idealDev) * clubSkill * 0.15;

        const score = distScore + terrainBonus + idealBonus;

        if (score > bestScore) {
          bestScore = score;
          bestClubIndex = ci;
          bestPower = power;
        }
      }
    }

    // --- Apply skill-based variance to the chosen shot ---
    const club = CLUBS[bestClubIndex];
    const clubSkill = this.getClubSkill(club.id);

    // Angle variance
    const combinedAccuracy = (this.skills.accuracy + clubSkill) / 2;
    const baseMaxAngle = tileType === TileType.GREEN ? 10 : 30;
    const maxAngle = baseMaxAngle * (1 - combinedAccuracy / 100);
    const variance = Phaser.Math.DegToRad((Math.random() - 0.5) * 2 * maxAngle);
    const angle = baseAngle + variance;

    // Power variance
    const combinedStrength = (this.skills.strength + clubSkill) / 2;
    const maxPowerDeviation = 0.4 * (1 - combinedStrength / 100);
    const power = Phaser.Math.Clamp(
      bestPower * (1 - maxPowerDeviation + Math.random() * maxPowerDeviation * 2),
      club.minPower,
      club.maxPower,
    );

    // Spin decision based on landing zone terrain
    const { spinDirection, spinAngle } = this.decideSpin(angle, power, club);

    this.ballPhysics.shoot(angle, power, club.loftDegrees, spinDirection, spinAngle);
    this.strokes++;
    this.hasTeedOff = true;
    this.state = GuestState.BALL_FLYING;
  }

  /**
   * Score landing terrain for club selection.
   * GREEN/FAIRWAY preferred, WATER heavily penalized.
   */
  private landingTerrainScore(tile: TileType): number {
    switch (tile) {
      case TileType.GREEN: return 3;
      case TileType.FAIRWAY: return 2;
      case TileType.TEE: return 1;
      case TileType.GRASS: return 0;
      case TileType.ROUGH: return -1;
      case TileType.SAND: return -3;
      case TileType.WATER: return -100;
      default: return -1;
    }
  }

  private getClubSkill(clubId: string): number {
    switch (clubId) {
      case 'driver': return this.skills.driver;
      case 'wood': return this.skills.wood;
      case 'iron': return this.skills.iron;
      case 'sandwedge': return this.skills.sandWedge;
      case 'putter': return this.skills.putter;
      default: return 50;
    }
  }

  private decideSpin(angle: number, power: number, club: { spinAngle: number }): { spinDirection: number; spinAngle: number } {
    const MIN_SPIN_SKILL = 20;
    const canSpinLeft = this.skills.leftSpin > MIN_SPIN_SKILL;
    const canSpinRight = this.skills.rightSpin > MIN_SPIN_SKILL;
    if (!canSpinLeft && !canSpinRight) return { spinDirection: 0, spinAngle: 0 };

    // Estimate landing position
    const ballPos = this.ballPhysics.getGroundPosition();
    const landX = ballPos.x + Math.cos(angle) * power;
    const landY = ballPos.y + Math.sin(angle) * power;
    const landTile = this.isoMap.worldToTile(landX, landY);
    const landTerrain = this.isoMap.getTileAt(landTile.tileX, landTile.tileY);

    // Good terrain — no spin needed
    if (landTerrain === TileType.FAIRWAY || landTerrain === TileType.GREEN || landTerrain === TileType.TEE) {
      return { spinDirection: 0, spinAngle: 0 };
    }

    // Bad terrain — check if spin can help
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const OFFSET = 40; // pixels to sample sideways

    let leftScore = 0;
    let rightScore = 0;

    for (const dist of [OFFSET, OFFSET * 2, OFFSET * 3]) {
      const lTile = this.isoMap.worldToTile(landX + perpX * dist, landY + perpY * dist);
      const rTile = this.isoMap.worldToTile(landX - perpX * dist, landY - perpY * dist);
      leftScore += this.terrainScore(this.isoMap.getTileAt(lTile.tileX, lTile.tileY));
      rightScore += this.terrainScore(this.isoMap.getTileAt(rTile.tileX, rTile.tileY));
    }

    // Pick the better side if the player has skill for it
    if (leftScore > rightScore && canSpinLeft) {
      return { spinDirection: -1, spinAngle: club.spinAngle * this.skills.leftSpin / 100 };
    }
    if (rightScore > leftScore && canSpinRight) {
      return { spinDirection: 1, spinAngle: club.spinAngle * this.skills.rightSpin / 100 };
    }

    return { spinDirection: 0, spinAngle: 0 };
  }

  private terrainScore(tileType: TileType): number {
    switch (tileType) {
      case TileType.FAIRWAY:
      case TileType.GREEN:
      case TileType.TEE:
        return 2;
      case TileType.GRASS:
      case TileType.ROUGH:
        return 1;
      case TileType.SAND:
        return 0;
      case TileType.WATER:
        return -2;
      default:
        return 0;
    }
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

  isAiming(): boolean {
    return this.state === GuestState.AIMING;
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
