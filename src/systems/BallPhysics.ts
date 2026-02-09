import Phaser from 'phaser';
import { IsometricMap } from './IsometricMap';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { EventBus } from '../utils/EventBus';

const STOP_THRESHOLD = 3;
const WATER_SPEED_THRESHOLD = 30;

export class BallPhysics {
  private scene: Phaser.Scene;
  private ball!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private isoMap: IsometricMap;
  private strokeCount = 0;
  private lastSafePosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, isoMap: IsometricMap) {
    this.scene = scene;
    this.isoMap = isoMap;
  }

  createBall(worldX: number, worldY: number): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    // Generate ball texture if needed
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
    this.ball.setBounce(0.3);
    this.ball.setDamping(true);
    this.ball.setDrag(0.92, 0.92);
    this.ball.setDepth(800);
    this.ball.body.setMaxVelocity(600, 600);

    this.lastSafePosition = { x: worldX, y: worldY };

    return this.ball;
  }

  shoot(angle: number, power: number): void {
    if (!this.ball) return;
    this.lastSafePosition = { x: this.ball.x, y: this.ball.y };

    const vx = Math.cos(angle) * power;
    const vy = Math.sin(angle) * power;
    this.ball.setVelocity(vx, vy);
    this.strokeCount++;
    EventBus.emit('stroke-taken', this.strokeCount);
  }

  update(_delta: number): void {
    if (!this.ball || !this.ball.body) return;

    const speed = this.ball.body.speed;
    if (speed < STOP_THRESHOLD) {
      this.ball.setVelocity(0, 0);
      return;
    }

    // Get terrain under ball
    const tileType = this.getTerrainUnderBall();
    const props = TILE_PROPERTIES[tileType];

    // Apply terrain-based drag
    this.ball.setDrag(props.friction, props.friction);

    // Water hazard detection
    if (tileType === TileType.WATER && speed < WATER_SPEED_THRESHOLD) {
      this.handleWaterHazard();
    }
  }

  private handleWaterHazard(): void {
    this.strokeCount++;
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(this.lastSafePosition.x, this.lastSafePosition.y);
    EventBus.emit('water-hazard', this.strokeCount);
  }

  private getTerrainUnderBall(): TileType {
    const { tileX, tileY } = this.isoMap.worldToTile(this.ball.x, this.ball.y);
    return this.isoMap.getTileAt(tileX, tileY);
  }

  isStopped(): boolean {
    if (!this.ball || !this.ball.body) return true;
    return this.ball.body.speed < STOP_THRESHOLD;
  }

  getBall(): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    return this.ball;
  }

  getStrokeCount(): number {
    return this.strokeCount;
  }

  resetStrokeCount(): void {
    this.strokeCount = 0;
  }

  moveBallTo(worldX: number, worldY: number): void {
    this.ball.setPosition(worldX, worldY);
    this.ball.setVelocity(0, 0);
    this.lastSafePosition = { x: worldX, y: worldY };
  }

  destroy(): void {
    if (this.ball) {
      this.ball.destroy();
    }
  }
}
