import Phaser from 'phaser';
import { IsometricMap } from './IsometricMap';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { EventBus } from '../utils/EventBus';
import { SPIN_DECAY } from '../models/Club';
import {
  GRAVITY, MIN_BOUNCE_VZ,
  TRAJECTORY_STEPS, TRAJECTORY_DT,
} from '../utils/Constants';

const STOP_THRESHOLD = 3;
const BOUNCE_HORIZONTAL_DAMPING = 0.6;

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
}

export class BallPhysics {
  private scene: Phaser.Scene;
  private ball!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private isoMap: IsometricMap;
  private strokeCount = 0;
  private lastSafePosition: { x: number; y: number } = { x: 0, y: 0 };

  // All movement is manually tracked — Phaser body only used for sprite display
  private z = 0;
  private vz = 0;
  private groundX = 0;
  private groundY = 0;
  private groundVx = 0;
  private groundVy = 0;
  private isAirborne = false;
  private isRolling = false;
  private shadowGraphics!: Phaser.GameObjects.Graphics;

  // Spin properties
  private spinDirection: number = 0;  // -1 = left, 0 = none, +1 = right
  private spinAngle: number = 0;      // effective spin angle in degrees

  constructor(scene: Phaser.Scene, isoMap: IsometricMap) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.setDepth(799);
  }

  createBall(worldX: number, worldY: number): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    if (!this.scene.textures.exists('ball')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(5, 5, 5);
      g.lineStyle(1, 0x888888, 1);
      g.strokeCircle(5, 5, 5);
      g.generateTexture('ball', 10, 10);
      g.destroy();
    }

    this.ball = this.scene.physics.add.sprite(worldX, worldY, 'ball');
    this.ball.setCircle(5);
    this.ball.setDepth(800);
    this.ball.body.enable = false; // We handle all movement manually

    this.groundX = worldX;
    this.groundY = worldY;
    this.groundVx = 0;
    this.groundVy = 0;
    this.z = 0;
    this.vz = 0;
    this.isAirborne = false;
    this.lastSafePosition = { x: worldX, y: worldY };

    return this.ball;
  }

  shoot(angle: number, power: number, loftDegrees: number, spinDirection: number = 0, spinAngle: number = 0): void {
    if (!this.ball) return;
    this.lastSafePosition = { x: this.groundX, y: this.groundY };

    // Store spin properties
    this.spinDirection = spinDirection;
    this.spinAngle = spinAngle;

    const loftRad = Phaser.Math.DegToRad(loftDegrees);
    const horizontalPower = power * Math.cos(loftRad);
    this.vz = power * Math.sin(loftRad);

    this.groundVx = Math.cos(angle) * horizontalPower;
    this.groundVy = Math.sin(angle) * horizontalPower;

    this.z = 0;
    this.groundX = this.ball.x;
    this.groundY = this.ball.y;

    if (this.vz > MIN_BOUNCE_VZ) {
      this.isAirborne = true;
      this.isRolling = false;
    } else {
      // Low loft: skip flight, go straight to rolling
      this.isAirborne = false;
      this.isRolling = true;
    }

    this.strokeCount++;
    EventBus.emit('stroke-taken', this.strokeCount);
  }

  update(delta: number): void {
    if (!this.ball) return;

    const dt = delta / 1000;

    if (this.isAirborne) {
      this.updateAirborne(dt);
    } else if (this.isRolling) {
      this.updateGround(dt);
    }

    this.drawShadow();
  }

  private updateAirborne(dt: number): void {
    // Manual position integration — no Phaser physics involved
    this.groundX += this.groundVx * dt;
    this.groundY += this.groundVy * dt;

    // Apply gravity to vertical velocity
    this.vz -= GRAVITY * dt;
    this.z += this.vz * dt;

    // Position ball sprite: ground position offset upward by z
    this.ball.setPosition(this.groundX, this.groundY - this.z);

    // Check landing
    if (this.z <= 0 && this.vz < 0) {
      this.z = 0;

      // Get terrain properties at landing position
      const tileType = this.getTerrainAtWorld(this.groundX, this.groundY);
      const props = TILE_PROPERTIES[tileType];

      if (Math.abs(this.vz) > MIN_BOUNCE_VZ && props.bounceFactor > 0) {
        // Bounce: invert and dampen vertical velocity, reduce horizontal
        this.vz = -this.vz * props.bounceFactor;
        this.groundVx *= BOUNCE_HORIZONTAL_DAMPING;
        this.groundVy *= BOUNCE_HORIZONTAL_DAMPING;

        // Apply spin rotation
        if (this.spinDirection !== 0 && this.spinAngle > 0) {
          const spinRad = Phaser.Math.DegToRad(this.spinAngle * this.spinDirection);
          const cos = Math.cos(spinRad);
          const sin = Math.sin(spinRad);
          const newVx = this.groundVx * cos - this.groundVy * sin;
          const newVy = this.groundVx * sin + this.groundVy * cos;
          this.groundVx = newVx;
          this.groundVy = newVy;
          this.spinAngle *= SPIN_DECAY; // decay: retain 60% per bounce
        }
      } else {
        // Done bouncing — transition to manual ground rolling
        this.vz = 0;
        this.isAirborne = false;
        this.isRolling = true;
        this.groundVx *= props.landingSpeedFactor;
        this.groundVy *= props.landingSpeedFactor;
        this.ball.setPosition(this.groundX, this.groundY);

        // Check if landed on hazard (water or out-of-bounds)
        if (this.isHazard(this.groundX, this.groundY)) {
          this.handleWaterHazard();
        }
      }
    }
  }

  private updateGround(dt: number): void {
    // Immediate hazard check (water or out-of-bounds)
    if (this.isHazard(this.groundX, this.groundY)) {
      this.handleWaterHazard();
      return;
    }

    const speed = Math.sqrt(this.groundVx * this.groundVx + this.groundVy * this.groundVy);

    if (speed < STOP_THRESHOLD) {
      this.groundVx = 0;
      this.groundVy = 0;
      this.isRolling = false;
      return;
    }

    // Get terrain friction at current position
    const tileType = this.getTerrainAtWorld(this.groundX, this.groundY);
    const props = TILE_PROPERTIES[tileType];

    // Apply terrain friction as damping multiplier (same as simulation)
    this.groundVx *= props.friction;
    this.groundVy *= props.friction;

    // Integrate position
    this.groundX += this.groundVx * dt;
    this.groundY += this.groundVy * dt;

    // Check hazard after movement
    if (this.isHazard(this.groundX, this.groundY)) {
      this.handleWaterHazard();
      return;
    }

    this.lastSafePosition = { x: this.groundX, y: this.groundY };
    this.ball.setPosition(this.groundX, this.groundY);
  }

  private drawShadow(): void {
    this.shadowGraphics.clear();
    if (!this.isAirborne || this.z <= 1) return;

    const shadowScale = Math.max(0.3, 1 - this.z / 300);
    const rx = 6 * shadowScale;
    const ry = 3 * shadowScale;
    const alpha = 0.4 * shadowScale;

    this.shadowGraphics.fillStyle(0x000000, alpha);
    this.shadowGraphics.fillEllipse(this.groundX, this.groundY, rx * 2, ry * 2);
  }

  private handleWaterHazard(): void {
    this.strokeCount++;
    this.groundVx = 0;
    this.groundVy = 0;
    this.z = 0;
    this.vz = 0;
    this.isAirborne = false;
    this.isRolling = false;
    this.spinDirection = 0;
    this.spinAngle = 0;
    this.groundX = this.lastSafePosition.x;
    this.groundY = this.lastSafePosition.y;
    this.ball.setPosition(this.lastSafePosition.x, this.lastSafePosition.y);
    EventBus.emit('water-hazard', this.strokeCount);
  }

  private isHazard(wx: number, wy: number): boolean {
    const { tileX, tileY } = this.isoMap.worldToTile(wx, wy);
    if (!this.isoMap.isInBounds(tileX, tileY)) return true;
    return this.isoMap.getTileAt(tileX, tileY) === TileType.WATER;
  }

  private getTerrainAtWorld(wx: number, wy: number): TileType {
    const { tileX, tileY } = this.isoMap.worldToTile(wx, wy);
    return this.isoMap.getTileAt(tileX, tileY);
  }

  simulateTrajectory(
    startX: number,
    startY: number,
    dirAngle: number,
    power: number,
    loftDegrees: number,
    spinDirection: number = 0,
    spinAngle: number = 0
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    const loftRad = Phaser.Math.DegToRad(loftDegrees);
    const horizontalPower = power * Math.cos(loftRad);
    let vz = power * Math.sin(loftRad);

    let vx = Math.cos(dirAngle) * horizontalPower;
    let vy = Math.sin(dirAngle) * horizontalPower;
    let x = startX;
    let y = startY;
    let z = 0;
    let landed = false;
    let bounces = 0;
    let currentSpinAngle = spinAngle;

    // If loft is too low for flight (same check as shoot()), skip flight and go straight to rolling
    const skipFlight = vz <= MIN_BOUNCE_VZ;

    if (!skipFlight) {
      for (let i = 0; i < TRAJECTORY_STEPS && !landed; i++) {
        x += vx * TRAJECTORY_DT;
        y += vy * TRAJECTORY_DT;
        vz -= GRAVITY * TRAJECTORY_DT;
        z += vz * TRAJECTORY_DT;

        if (z <= 0 && vz < 0) {
          z = 0;
          // Get actual terrain at bounce position
          const terrainProps = TILE_PROPERTIES[this.getTerrainAtWorld(x, y)];

          if (Math.abs(vz) > MIN_BOUNCE_VZ && terrainProps.bounceFactor > 0 && bounces < 3) {
            vz = -vz * terrainProps.bounceFactor;
            vx *= BOUNCE_HORIZONTAL_DAMPING;
            vy *= BOUNCE_HORIZONTAL_DAMPING;
            bounces++;

            // Apply spin rotation (same as actual physics)
            if (spinDirection !== 0 && currentSpinAngle > 0) {
              const spinRad = Phaser.Math.DegToRad(currentSpinAngle * spinDirection);
              const cos = Math.cos(spinRad);
              const sin = Math.sin(spinRad);
              const newVx = vx * cos - vy * sin;
              const newVy = vx * sin + vy * cos;
              vx = newVx;
              vy = newVy;
              currentSpinAngle *= SPIN_DECAY;
            }
          } else {
            landed = true;
          }
        }

        points.push({ x, y, z: Math.max(0, z) });
      }

      // After flight: apply landing speed reduction based on actual terrain
      const landingProps = TILE_PROPERTIES[this.getTerrainAtWorld(x, y)];
      vx *= landingProps.landingSpeedFactor;
      vy *= landingProps.landingSpeedFactor;
    }
    // If skipFlight: vx/vy keep full power (same as real shoot() for low loft)

    // Simulate ground rolling with actual terrain friction
    const ROLL_DT = TRAJECTORY_DT;
    const maxRollSteps = 200;
    for (let i = 0; i < maxRollSteps; i++) {
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < STOP_THRESHOLD) break;

      const rollProps = TILE_PROPERTIES[this.getTerrainAtWorld(x, y)];
      vx *= rollProps.friction;
      vy *= rollProps.friction;
      x += vx * ROLL_DT;
      y += vy * ROLL_DT;

      points.push({ x, y, z: 0 });
    }

    return points;
  }

  isStopped(): boolean {
    if (!this.ball) return true;
    if (this.isAirborne || this.isRolling) return false;
    return true;
  }

  isInFlight(): boolean {
    return this.isAirborne;
  }

  getBall(): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    return this.ball;
  }

  getGroundPosition(): { x: number; y: number } {
    return { x: this.groundX, y: this.groundY };
  }

  getHeight(): number {
    return this.z;
  }

  getStrokeCount(): number {
    return this.strokeCount;
  }

  resetStrokeCount(): void {
    this.strokeCount = 0;
  }

  moveBallTo(worldX: number, worldY: number): void {
    this.ball.setPosition(worldX, worldY);
    this.groundX = worldX;
    this.groundY = worldY;
    this.groundVx = 0;
    this.groundVy = 0;
    this.z = 0;
    this.vz = 0;
    this.isAirborne = false;
    this.isRolling = false;
    this.spinDirection = 0;
    this.spinAngle = 0;
    this.lastSafePosition = { x: worldX, y: worldY };
  }

  destroy(): void {
    if (this.ball) this.ball.destroy();
    if (this.shadowGraphics) this.shadowGraphics.destroy();
  }
}
