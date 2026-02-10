import Phaser from 'phaser';
import { BallPhysics } from '../systems/BallPhysics';
import { EventBus } from '../utils/EventBus';
import { Club, CLUBS, DEFAULT_CLUB_INDEX } from '../models/Club';
import { TileType } from '../models/TileTypes';
import { IsometricMap } from '../systems/IsometricMap';
import { t } from '../i18n/i18n';
import { PlayerHitParams, DEFAULT_HIT_PARAMS } from '../models/PlayerHitParams';
import { ShotPanel } from '../ui/ShotPanel';

export enum AimState {
  WAITING = 'waiting',   // player walking to ball
  IDLE = 'idle',         // player at ball, can aim
  ROLLING = 'rolling',   // ball in motion
}

export class AimingSystem {
  private scene: Phaser.Scene;
  private ballPhysics: BallPhysics;
  private isoMap: IsometricMap;
  private shotPanel: ShotPanel;
  private state: AimState = AimState.WAITING;
  private aimGraphics: Phaser.GameObjects.Graphics;
  private trajectoryGraphics: Phaser.GameObjects.Graphics;
  private powerText: Phaser.GameObjects.Text;
  private clubIndex: number = DEFAULT_CLUB_INDEX;
  private hitParams: PlayerHitParams = DEFAULT_HIT_PARAMS;

  // Current aim data (updated on mouse move)
  private currentAngle: number = 0;
  private currentPower: number = 0;
  private hasValidAim: boolean = false;

  constructor(scene: Phaser.Scene, ballPhysics: BallPhysics, isoMap: IsometricMap, shotPanel: ShotPanel) {
    this.scene = scene;
    this.ballPhysics = ballPhysics;
    this.isoMap = isoMap;
    this.shotPanel = shotPanel;

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

    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('wheel', this.onWheel, this);

    // Number keys to select clubs directly (1-5)
    scene.input.keyboard!.on('keydown-ONE', () => this.selectClub(0));
    scene.input.keyboard!.on('keydown-TWO', () => this.selectClub(1));
    scene.input.keyboard!.on('keydown-THREE', () => this.selectClub(2));
    scene.input.keyboard!.on('keydown-FOUR', () => this.selectClub(3));
    scene.input.keyboard!.on('keydown-FIVE', () => this.selectClub(4));

    // Listen for club changes from ShotPanel
    EventBus.on('club-changed', (index: number) => {
      this.selectClubFromPanel(index);
    });

    // Listen for player arriving at ball
    EventBus.on('player-arrived', () => {
      if (this.state === AimState.WAITING) {
        this.state = AimState.IDLE;
      }
    });
  }

  get currentClub(): Club {
    return CLUBS[this.clubIndex];
  }

  private selectClub(index: number): void {
    if (index < 0 || index >= CLUBS.length) return;
    const club = CLUBS[index];
    if (club.teeOnly && !this.isOnTee()) {
      EventBus.emit('club-restricted', t('clubs.teeOnly'));
      return;
    }
    this.clubIndex = index;
    this.shotPanel.setSelectedClubIndex(index);
  }

  private selectClubFromPanel(index: number): void {
    if (index < 0 || index >= CLUBS.length) return;
    const club = CLUBS[index];
    if (club.teeOnly && !this.isOnTee()) {
      EventBus.emit('club-restricted', t('clubs.teeOnly'));
      this.shotPanel.setSelectedClubIndex(this.clubIndex);
      return;
    }
    this.clubIndex = index;
  }

  private isOnTee(): boolean {
    const groundPos = this.ballPhysics.getGroundPosition();
    const { tileX, tileY } = this.isoMap.worldToTile(groundPos.x, groundPos.y);
    return this.isoMap.getTileAt(tileX, tileY) === TileType.TEE;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.IDLE) {
      this.clearAimGraphics();
      return;
    }

    const ball = this.ballPhysics.getBall();
    const ballX = ball.x;
    const ballY = ball.y;
    const mouseX = pointer.worldX;
    const mouseY = pointer.worldY;

    const dx = mouseX - ballX;
    const dy = mouseY - ballY;
    const distToMouse = Math.sqrt(dx * dx + dy * dy);

    if (distToMouse < 10) {
      this.clearAimGraphics();
      this.hasValidAim = false;
      return;
    }

    this.currentAngle = Math.atan2(dy, dx);

    // Find optimal power to land ball near mouse
    this.currentPower = this.findOptimalPower(ballX, ballY, this.currentAngle, mouseX, mouseY);
    this.hasValidAim = true;

    // Draw aim indicator and trajectory
    this.drawAimIndicator(ballX, ballY, mouseX, mouseY);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state !== AimState.IDLE) return;
    if (!this.hasValidAim) return;
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;

    // Check if clicking on UI elements (ShotPanel area - bottom right)
    const { width, height } = this.scene.scale;
    const panelX = width - 210;
    const panelY = height - 250;
    if (pointer.x >= panelX && pointer.y >= panelY) return; // Click is on panel

    const angle = this.currentAngle;
    const power = this.currentPower;

    // Get terrain under ball for modifiers
    const groundPos = this.ballPhysics.getGroundPosition();
    const { tileX, tileY } = this.isoMap.worldToTile(groundPos.x, groundPos.y);
    const tileType = this.isoMap.getTileAt(tileX, tileY);
    const terrainMod = this.currentClub.terrainModifiers[tileType];

    // Apply player hit variance with terrain modifiers
    const speedMin = this.hitParams.hitSpeedDifferenceMin + (terrainMod?.hitSpeedDifferenceMin ?? 0);
    const speedMax = this.hitParams.hitSpeedDifferenceMax + (terrainMod?.hitSpeedDifferenceMax ?? 0);
    const accuracy = this.hitParams.hitAccuracy + (terrainMod?.hitAccuracy ?? 0);

    const speedFactor = 1 + speedMin + Math.random() * (speedMax - speedMin);
    const actualPower = power * speedFactor;

    const maxDeviationRad = Phaser.Math.DegToRad(accuracy);
    const actualAngle = angle + (Math.random() * 2 - 1) * maxDeviationRad;

    // Get spin
    const spinDirection = this.shotPanel.getSelectedSpin();
    const effectiveSpinAngle = Math.max(0, this.currentClub.spinAngle + (terrainMod?.spinAngle ?? 0));

    this.ballPhysics.shoot(actualAngle, actualPower, this.currentClub.loftDegrees, spinDirection, effectiveSpinAngle);
    this.state = AimState.ROLLING;

    this.clearAimGraphics();
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown[],
    _deltaX: number,
    deltaY: number
  ): void {
    if (this.state !== AimState.IDLE) return;

    if (deltaY < 0) {
      let newIndex = this.clubIndex - 1;
      if (newIndex < 0) newIndex = CLUBS.length - 1;
      this.selectClub(newIndex);
    } else {
      let newIndex = this.clubIndex + 1;
      if (newIndex >= CLUBS.length) newIndex = 0;
      this.selectClub(newIndex);
    }
  }

  private findOptimalPower(ballX: number, ballY: number, angle: number, targetX: number, targetY: number): number {
    const club = this.currentClub;
    const steps = 10;
    let bestPower = club.minPower;
    let bestDist = Infinity;

    // Also consider spin for trajectory simulation
    const spinDirection = this.shotPanel.getSelectedSpin();
    const groundPos = this.ballPhysics.getGroundPosition();
    const { tileX, tileY } = this.isoMap.worldToTile(groundPos.x, groundPos.y);
    const tileType = this.isoMap.getTileAt(tileX, tileY);
    const terrainMod = this.currentClub.terrainModifiers[tileType];
    const effectiveSpinAngle = Math.max(0, club.spinAngle + (terrainMod?.spinAngle ?? 0));

    for (let i = 0; i <= steps; i++) {
      const power = club.minPower + (club.maxPower - club.minPower) * (i / steps);
      const points = this.ballPhysics.simulateTrajectory(
        ballX, ballY, angle, power, club.loftDegrees,
        spinDirection, effectiveSpinAngle
      );
      if (points.length === 0) continue;

      const lastPt = points[points.length - 1];
      const dist = Math.sqrt((lastPt.x - targetX) ** 2 + (lastPt.y - targetY) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestPower = power;
      }
    }

    return bestPower;
  }

  private drawAimIndicator(ballX: number, ballY: number, mouseX: number, mouseY: number): void {
    this.aimGraphics.clear();
    this.trajectoryGraphics.clear();

    const power = this.currentPower;
    const angle = this.currentAngle;
    const club = this.currentClub;
    const normalizedPower = (power - club.minPower) / (club.maxPower - club.minPower);

    // Color: green (weak) -> yellow -> red (strong)
    const r = Math.floor(normalizedPower * 255);
    const g = Math.floor((1 - normalizedPower) * 255);
    const color = (r << 16) | (g << 8) | 0;

    // Direction arrow from ball toward mouse
    const lineLength = 30 + normalizedPower * 60;
    const endX = ballX + Math.cos(angle) * lineLength;
    const endY = ballY + Math.sin(angle) * lineLength;

    this.aimGraphics.lineStyle(3, color, 0.9);
    this.aimGraphics.lineBetween(ballX, ballY, endX, endY);

    // Arrow head
    const headLen = 8;
    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    this.aimGraphics.lineBetween(endX, endY, endX + Math.cos(headAngle1) * headLen, endY + Math.sin(headAngle1) * headLen);
    this.aimGraphics.lineBetween(endX, endY, endX + Math.cos(headAngle2) * headLen, endY + Math.sin(headAngle2) * headLen);

    // Power ring
    this.aimGraphics.lineStyle(2, color, 0.4);
    this.aimGraphics.strokeCircle(ballX, ballY, 8 + normalizedPower * 12);

    // Mouse target crosshair
    this.aimGraphics.lineStyle(1, 0xffff00, 0.5);
    this.aimGraphics.strokeCircle(mouseX, mouseY, 8);
    this.aimGraphics.lineBetween(mouseX - 12, mouseY, mouseX + 12, mouseY);
    this.aimGraphics.lineBetween(mouseX, mouseY - 12, mouseX, mouseY + 12);

    // Draw trajectory
    this.drawTrajectoryPreview(ballX, ballY, angle, power, color);

    // Info text
    const powerPercent = Math.round(normalizedPower * 100);
    const clubName = t(club.nameKey as any);
    this.powerText.setText(`${clubName} | ${powerPercent}%`);
    this.powerText.setPosition(ballX + 15, ballY - 25);
    this.powerText.setVisible(true);
  }

  private drawTrajectoryPreview(
    startX: number,
    startY: number,
    angle: number,
    power: number,
    color: number
  ): void {
    const spinDirection = this.shotPanel.getSelectedSpin();
    const groundPos = this.ballPhysics.getGroundPosition();
    const { tileX, tileY } = this.isoMap.worldToTile(groundPos.x, groundPos.y);
    const tileType = this.isoMap.getTileAt(tileX, tileY);
    const terrainMod = this.currentClub.terrainModifiers[tileType];
    const effectiveSpinAngle = Math.max(0, this.currentClub.spinAngle + (terrainMod?.spinAngle ?? 0));

    const points = this.ballPhysics.simulateTrajectory(
      startX, startY, angle, power, this.currentClub.loftDegrees,
      spinDirection, effectiveSpinAngle
    );
    if (points.length === 0) return;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const alpha = 0.7 - (i / points.length) * 0.5;

      this.trajectoryGraphics.fillStyle(0xffffff, alpha * 0.4);
      this.trajectoryGraphics.fillCircle(pt.x, pt.y, 2);

      if (pt.z > 2) {
        const visualZ = pt.z;
        this.trajectoryGraphics.lineStyle(1, color, alpha * 0.6);
        this.trajectoryGraphics.lineBetween(pt.x, pt.y, pt.x, pt.y - visualZ);

        this.trajectoryGraphics.fillStyle(color, alpha);
        this.trajectoryGraphics.fillCircle(pt.x, pt.y - visualZ, 2.5);
      } else {
        this.trajectoryGraphics.fillStyle(color, alpha * 0.8);
        this.trajectoryGraphics.fillCircle(pt.x, pt.y, 2);
      }
    }

    // Landing marker
    const lastPt = points[points.length - 1];
    this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.6);
    this.trajectoryGraphics.strokeCircle(lastPt.x, lastPt.y, 6);
    this.trajectoryGraphics.lineStyle(1, 0xffff00, 0.6);
    this.trajectoryGraphics.lineBetween(lastPt.x - 4, lastPt.y - 4, lastPt.x + 4, lastPt.y + 4);
    this.trajectoryGraphics.lineBetween(lastPt.x + 4, lastPt.y - 4, lastPt.x - 4, lastPt.y + 4);
  }

  private clearAimGraphics(): void {
    this.aimGraphics.clear();
    this.trajectoryGraphics.clear();
    this.powerText.setVisible(false);
    this.hasValidAim = false;
  }

  // Called when ball stops to start waiting for player to walk
  startWaiting(): void {
    this.state = AimState.WAITING;
    this.clearAimGraphics();
  }

  update(): void {
    if (this.state === AimState.ROLLING && this.ballPhysics.isStopped()) {
      this.state = AimState.WAITING;
      this.clearAimGraphics();
      EventBus.emit('ball-stopped');
    }
  }

  getState(): AimState {
    return this.state;
  }

  isAiming(): boolean {
    return this.state === AimState.IDLE;
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('wheel', this.onWheel, this);
    EventBus.off('club-changed');
    EventBus.off('player-arrived');
    this.aimGraphics.destroy();
    this.trajectoryGraphics.destroy();
    this.powerText.destroy();
  }
}
