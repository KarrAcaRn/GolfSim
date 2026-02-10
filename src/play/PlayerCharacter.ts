import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';

const WALK_SPEED = 120; // pixels per second
const ARRIVE_THRESHOLD = 5; // distance to consider "arrived"

export class PlayerCharacter {
  private scene: Phaser.Scene;
  private sprite!: Phaser.GameObjects.Sprite;
  private targetX: number = 0;
  private targetY: number = 0;
  private isWalking: boolean = false;
  private arrived: boolean = false;
  private bobTimer: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createTexture();
    this.sprite = scene.add.sprite(0, 0, 'player');
    this.sprite.setDepth(850);
    this.sprite.setVisible(false);
  }

  private createTexture(): void {
    if (this.scene.textures.exists('player')) return;

    const g = this.scene.add.graphics();

    // Simple pixel art golfer (~12x16)
    // Body
    g.fillStyle(0x2255aa, 1); // blue shirt
    g.fillRect(3, 6, 6, 6);  // torso

    // Pants
    g.fillStyle(0x443322, 1); // brown pants
    g.fillRect(3, 12, 3, 4); // left leg
    g.fillRect(6, 12, 3, 4); // right leg

    // Head
    g.fillStyle(0xffcc99, 1); // skin
    g.fillRect(4, 1, 4, 5);  // head

    // Hat
    g.fillStyle(0xffffff, 1);
    g.fillRect(3, 0, 6, 2);  // hat brim

    // Arms
    g.fillStyle(0xffcc99, 1);
    g.fillRect(1, 7, 2, 4);  // left arm
    g.fillRect(9, 7, 2, 4);  // right arm

    g.generateTexture('player', 12, 16);
    g.destroy();
  }

  walkTo(worldX: number, worldY: number): void {
    this.targetX = worldX;
    this.targetY = worldY;
    this.isWalking = true;
    this.arrived = false;
    this.sprite.setVisible(true);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setVisible(true);
  }

  update(delta: number): void {
    if (!this.isWalking) return;

    const dt = delta / 1000;
    const dx = this.targetX - this.sprite.x;
    const dy = this.targetY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVE_THRESHOLD) {
      this.sprite.setPosition(this.targetX, this.targetY);
      this.isWalking = false;
      this.arrived = true;
      this.sprite.setY(this.targetY); // reset bob
      EventBus.emit('player-arrived');
      return;
    }

    // Move toward target
    const speed = WALK_SPEED * dt;
    const ratio = Math.min(speed / dist, 1);
    this.sprite.setX(this.sprite.x + dx * ratio);
    this.sprite.setY(this.sprite.y + dy * ratio);

    // Flip sprite based on direction
    this.sprite.setFlipX(dx < 0);

    // Walking bob animation
    this.bobTimer += delta;
    const bob = Math.sin(this.bobTimer * 0.01) * 2;
    this.sprite.setY(this.sprite.y + bob);
  }

  isAtBall(): boolean {
    return this.arrived && !this.isWalking;
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  destroy(): void {
    if (this.sprite) this.sprite.destroy();
  }
}
