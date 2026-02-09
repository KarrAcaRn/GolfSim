import Phaser from 'phaser';
import { BallPhysics } from '../systems/BallPhysics';
import { MAX_POWER, MIN_POWER_THRESHOLD, MAX_DRAG_DISTANCE } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export enum AimState {
  IDLE = 'idle',
  AIMING = 'aiming',
  ROLLING = 'rolling',
}

export class AimingSystem {
  private scene: Phaser.Scene;
  private ballPhysics: BallPhysics;
  private state: AimState = AimState.IDLE;
  private dragStart: Phaser.Math.Vector2 | null = null;
  private aimGraphics: Phaser.GameObjects.Graphics;
  private powerText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, ballPhysics: BallPhysics) {
    this.scene = scene;
    this.ballPhysics = ballPhysics;

    this.aimGraphics = scene.add.graphics();
    this.aimGraphics.setDepth(900);

    this.powerText = scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 },
    }).setDepth(901).setVisible(false);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.IDLE) return;
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;
    if (!this.ballPhysics.isStopped()) return;

    const ball = this.ballPhysics.getBall();
    const dist = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, ball.x, ball.y);
    if (dist > 40) return; // Must click near the ball

    this.state = AimState.AIMING;
    this.dragStart = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.AIMING || !this.dragStart) return;

    this.drawAimIndicator(pointer.worldX, pointer.worldY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.AIMING || !this.dragStart) return;

    const ball = this.ballPhysics.getBall();
    const dx = this.dragStart.x - pointer.worldX;
    const dy = this.dragStart.y - pointer.worldY;
    const distance = Math.min(
      Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointer.worldX, pointer.worldY),
      MAX_DRAG_DISTANCE
    );
    const power = (distance / MAX_DRAG_DISTANCE) * MAX_POWER;

    if (power > MIN_POWER_THRESHOLD) {
      // Direction is from ball in the opposite direction of drag
      const angle = Math.atan2(dy, dx);
      this.ballPhysics.shoot(angle, power);
      this.state = AimState.ROLLING;
    } else {
      this.state = AimState.IDLE;
    }

    this.aimGraphics.clear();
    this.powerText.setVisible(false);
    this.dragStart = null;
  }

  private drawAimIndicator(pointerX: number, pointerY: number): void {
    if (!this.dragStart) return;

    this.aimGraphics.clear();
    const ball = this.ballPhysics.getBall();

    // Direction opposite to drag
    const dx = this.dragStart.x - pointerX;
    const dy = this.dragStart.y - pointerY;
    const angle = Math.atan2(dy, dx);
    const distance = Math.min(
      Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointerX, pointerY),
      MAX_DRAG_DISTANCE
    );
    const power = (distance / MAX_DRAG_DISTANCE) * MAX_POWER;
    const normalizedPower = distance / MAX_DRAG_DISTANCE;

    // Draw aim line from ball in the shot direction
    const lineLength = 30 + normalizedPower * 80;
    const endX = ball.x + Math.cos(angle) * lineLength;
    const endY = ball.y + Math.sin(angle) * lineLength;

    // Color: green (weak) -> yellow -> red (strong)
    const r = Math.floor(normalizedPower * 255);
    const g = Math.floor((1 - normalizedPower) * 255);
    const color = (r << 16) | (g << 8) | 0;

    // Arrow line
    this.aimGraphics.lineStyle(3, color, 0.9);
    this.aimGraphics.lineBetween(ball.x, ball.y, endX, endY);

    // Arrow head
    const headLen = 8;
    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    this.aimGraphics.lineBetween(
      endX, endY,
      endX + Math.cos(headAngle1) * headLen,
      endY + Math.sin(headAngle1) * headLen
    );
    this.aimGraphics.lineBetween(
      endX, endY,
      endX + Math.cos(headAngle2) * headLen,
      endY + Math.sin(headAngle2) * headLen
    );

    // Drag line (faded)
    this.aimGraphics.lineStyle(1, 0xffffff, 0.3);
    this.aimGraphics.lineBetween(ball.x, ball.y, pointerX, pointerY);

    // Power indicator circle around ball
    this.aimGraphics.lineStyle(2, color, 0.5);
    this.aimGraphics.strokeCircle(ball.x, ball.y, 8 + normalizedPower * 12);

    // Power text
    const powerPercent = Math.round(normalizedPower * 100);
    this.powerText.setText(`${powerPercent}%`);
    this.powerText.setPosition(ball.x + 15, ball.y - 20);
    this.powerText.setVisible(true);
  }

  update(): void {
    if (this.state === AimState.ROLLING && this.ballPhysics.isStopped()) {
      this.state = AimState.IDLE;
      EventBus.emit('ball-stopped');
    }
  }

  getState(): AimState {
    return this.state;
  }

  isAiming(): boolean {
    return this.state === AimState.AIMING;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.aimGraphics.destroy();
    this.powerText.destroy();
  }
}
