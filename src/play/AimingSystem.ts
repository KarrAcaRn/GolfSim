import Phaser from 'phaser';
import { BallPhysics } from '../systems/BallPhysics';
import { MIN_POWER_THRESHOLD, MAX_DRAG_DISTANCE } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { Club, CLUBS, DEFAULT_CLUB_INDEX } from '../models/Club';
import { TileType } from '../models/TileTypes';
import { IsometricMap } from '../systems/IsometricMap';
import { t } from '../i18n/i18n';

export enum AimState {
  IDLE = 'idle',
  AIMING = 'aiming',
  ROLLING = 'rolling',
}

export class AimingSystem {
  private scene: Phaser.Scene;
  private ballPhysics: BallPhysics;
  private isoMap: IsometricMap;
  private state: AimState = AimState.IDLE;
  private dragStart: Phaser.Math.Vector2 | null = null;
  private aimGraphics: Phaser.GameObjects.Graphics;
  private trajectoryGraphics: Phaser.GameObjects.Graphics;
  private powerText: Phaser.GameObjects.Text;
  private clubIndex: number = DEFAULT_CLUB_INDEX;

  constructor(scene: Phaser.Scene, ballPhysics: BallPhysics, isoMap: IsometricMap) {
    this.scene = scene;
    this.ballPhysics = ballPhysics;
    this.isoMap = isoMap;

    this.aimGraphics = scene.add.graphics();
    this.aimGraphics.setDepth(900);

    this.trajectoryGraphics = scene.add.graphics();
    this.trajectoryGraphics.setDepth(899);

    this.powerText = scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 },
    }).setDepth(901).setVisible(false);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('wheel', this.onWheel, this);

    // Number keys to select clubs directly (1-5)
    scene.input.keyboard!.on('keydown-ONE', () => this.selectClub(0));
    scene.input.keyboard!.on('keydown-TWO', () => this.selectClub(1));
    scene.input.keyboard!.on('keydown-THREE', () => this.selectClub(2));
    scene.input.keyboard!.on('keydown-FOUR', () => this.selectClub(3));
    scene.input.keyboard!.on('keydown-FIVE', () => this.selectClub(4));
  }

  get currentClub(): Club {
    return CLUBS[this.clubIndex];
  }

  private selectClub(index: number): void {
    if (index < 0 || index >= CLUBS.length) return;

    const club = CLUBS[index];

    // Check if trying to select driver and not on tee
    if (club.teeOnly && !this.isOnTee()) {
      EventBus.emit('club-restricted', t('clubs.teeOnly'));
      return;
    }

    this.clubIndex = index;
  }

  private isOnTee(): boolean {
    const groundPos = this.ballPhysics.getGroundPosition();
    const { tileX, tileY } = this.isoMap.worldToTile(groundPos.x, groundPos.y);
    const tileType = this.isoMap.getTileAt(tileX, tileY);
    return tileType === TileType.TEE;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.IDLE) return;
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;
    if (!this.ballPhysics.isStopped()) return;

    const ball = this.ballPhysics.getBall();
    const dist = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, ball.x, ball.y);
    if (dist > 40) return;

    this.state = AimState.AIMING;
    this.dragStart = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.AIMING || !this.dragStart) return;
    this.drawAimIndicator(pointer.worldX, pointer.worldY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.AIMING || !this.dragStart) return;

    const dx = this.dragStart.x - pointer.worldX;
    const dy = this.dragStart.y - pointer.worldY;
    const distance = Math.min(
      Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointer.worldX, pointer.worldY),
      MAX_DRAG_DISTANCE
    );
    const power = (distance / MAX_DRAG_DISTANCE) * this.currentClub.maxPower;

    if (power > MIN_POWER_THRESHOLD) {
      const angle = Math.atan2(dy, dx);
      this.ballPhysics.shoot(angle, power, this.currentClub.loftDegrees);
      this.state = AimState.ROLLING;
    } else {
      this.state = AimState.IDLE;
    }

    this.aimGraphics.clear();
    this.trajectoryGraphics.clear();
    this.powerText.setVisible(false);
    this.dragStart = null;
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown[],
    _deltaX: number,
    deltaY: number
  ): void {
    if (this.state !== AimState.AIMING) return;

    // Scroll up = previous club, scroll down = next club
    if (deltaY < 0) {
      // Previous club
      let newIndex = this.clubIndex - 1;
      if (newIndex < 0) newIndex = CLUBS.length - 1;
      this.selectClub(newIndex);
    } else {
      // Next club
      let newIndex = this.clubIndex + 1;
      if (newIndex >= CLUBS.length) newIndex = 0;
      this.selectClub(newIndex);
    }
  }

  private drawAimIndicator(pointerX: number, pointerY: number): void {
    if (!this.dragStart) return;

    this.aimGraphics.clear();
    this.trajectoryGraphics.clear();
    const ball = this.ballPhysics.getBall();

    // Direction opposite to drag
    const dx = this.dragStart.x - pointerX;
    const dy = this.dragStart.y - pointerY;
    const angle = Math.atan2(dy, dx);
    const distance = Math.min(
      Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointerX, pointerY),
      MAX_DRAG_DISTANCE
    );
    const power = (distance / MAX_DRAG_DISTANCE) * this.currentClub.maxPower;
    const normalizedPower = distance / MAX_DRAG_DISTANCE;

    // Color: green (weak) -> yellow -> red (strong)
    const r = Math.floor(normalizedPower * 255);
    const g = Math.floor((1 - normalizedPower) * 255);
    const color = (r << 16) | (g << 8) | 0;

    // Direction arrow
    const lineLength = 30 + normalizedPower * 60;
    const endX = ball.x + Math.cos(angle) * lineLength;
    const endY = ball.y + Math.sin(angle) * lineLength;

    this.aimGraphics.lineStyle(3, color, 0.9);
    this.aimGraphics.lineBetween(ball.x, ball.y, endX, endY);

    // Arrow head
    const headLen = 8;
    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    this.aimGraphics.lineBetween(endX, endY, endX + Math.cos(headAngle1) * headLen, endY + Math.sin(headAngle1) * headLen);
    this.aimGraphics.lineBetween(endX, endY, endX + Math.cos(headAngle2) * headLen, endY + Math.sin(headAngle2) * headLen);

    // Power indicator ring
    this.aimGraphics.lineStyle(2, color, 0.4);
    this.aimGraphics.strokeCircle(ball.x, ball.y, 8 + normalizedPower * 12);

    // Draw trajectory preview
    if (power > MIN_POWER_THRESHOLD) {
      this.drawTrajectoryPreview(ball.x, ball.y, angle, power, color);
    }

    // Info text: club name + power
    const powerPercent = Math.round(normalizedPower * 100);
    const clubName = t(this.currentClub.nameKey as any);
    this.powerText.setText(`${clubName} | Power: ${powerPercent}%`);
    this.powerText.setPosition(ball.x + 15, ball.y - 25);
    this.powerText.setVisible(true);
  }

  private drawTrajectoryPreview(
    startX: number,
    startY: number,
    angle: number,
    power: number,
    color: number
  ): void {
    const points = this.ballPhysics.simulateTrajectory(startX, startY, angle, power, this.currentClub.loftDegrees);
    if (points.length === 0) return;

    // Draw dots along the trajectory ground path
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const alpha = 0.7 - (i / points.length) * 0.5;

      // Ground dot (where the shadow would be)
      this.trajectoryGraphics.fillStyle(0xffffff, alpha * 0.4);
      this.trajectoryGraphics.fillCircle(pt.x, pt.y, 2);

      // Height indicator: vertical line from ground up
      if (pt.z > 2) {
        const visualZ = pt.z;
        this.trajectoryGraphics.lineStyle(1, color, alpha * 0.6);
        this.trajectoryGraphics.lineBetween(pt.x, pt.y, pt.x, pt.y - visualZ);

        // Ball position dot in the air
        this.trajectoryGraphics.fillStyle(color, alpha);
        this.trajectoryGraphics.fillCircle(pt.x, pt.y - visualZ, 2.5);
      } else {
        // Ball on ground
        this.trajectoryGraphics.fillStyle(color, alpha * 0.8);
        this.trajectoryGraphics.fillCircle(pt.x, pt.y, 2);
      }
    }

    // Mark landing point (last point)
    const lastPt = points[points.length - 1];
    this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.6);
    this.trajectoryGraphics.strokeCircle(lastPt.x, lastPt.y, 6);

    // Landing X marker
    this.trajectoryGraphics.lineStyle(1, 0xffff00, 0.6);
    this.trajectoryGraphics.lineBetween(lastPt.x - 4, lastPt.y - 4, lastPt.x + 4, lastPt.y + 4);
    this.trajectoryGraphics.lineBetween(lastPt.x + 4, lastPt.y - 4, lastPt.x - 4, lastPt.y + 4);
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
    this.scene.input.off('wheel', this.onWheel, this);
    this.aimGraphics.destroy();
    this.trajectoryGraphics.destroy();
    this.powerText.destroy();
  }
}
