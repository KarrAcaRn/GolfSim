import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { CameraController } from '../systems/CameraController';
import { BallPhysics } from '../systems/BallPhysics';
import { AimingSystem } from '../play/AimingSystem';
import { HoleData } from '../models/HoleData';
import { CourseData } from '../models/CourseData';
import { EventBus } from '../utils/EventBus';
import { HOLE_SINK_RADIUS } from '../utils/Constants';
import { ScoreCard } from '../ui/ScoreCard';
import { t } from '../i18n/i18n';

export class PlayScene extends Phaser.Scene {
  private isoMap!: IsometricMap;
  private cameraController!: CameraController;
  private ballPhysics!: BallPhysics;
  private aimingSystem!: AimingSystem;
  private courseData!: CourseData;

  private currentHoleIndex = 0;
  private holeStrokes: number[] = [];
  private hud!: {
    holeText: Phaser.GameObjects.Text;
    strokeText: Phaser.GameObjects.Text;
    messageText: Phaser.GameObjects.Text;
  };
  private markerGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'Play' });
  }

  create(data: { courseData: CourseData }): void {
    this.courseData = data.courseData;
    this.currentHoleIndex = 0;
    this.holeStrokes = new Array(this.courseData.holes.length).fill(0);

    // Render the course (read-only)
    this.isoMap = new IsometricMap(this, this.courseData.width, this.courseData.height);
    this.isoMap.loadFromData(this.courseData);

    // Camera
    const bounds = this.isoMap.getWorldBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameraController = new CameraController(this);

    // Hole markers
    this.markerGraphics = this.add.graphics();
    this.markerGraphics.setDepth(500);
    this.renderHoleMarkers();

    // Ball physics
    this.ballPhysics = new BallPhysics(this, this.isoMap);

    // Place ball at first hole's tee
    const firstHole = this.courseData.holes[0];
    const teePos = this.isoMap.tileToWorld(firstHole.teePosition.tileX, firstHole.teePosition.tileY);
    this.ballPhysics.createBall(teePos.x, teePos.y);

    // Center camera on ball
    this.cameras.main.centerOn(teePos.x, teePos.y);

    // Aiming system
    this.aimingSystem = new AimingSystem(this, this.ballPhysics);

    // HUD
    this.createHUD();

    // Event listeners
    this.setupEventListeners();

    // Pause on ESC
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.pause();
      this.scene.launch('Pause', { callingScene: 'Play' });
    });

    this.updateHUD();
  }

  private createHUD(): void {
    const { width } = this.scale;

    this.hud = {
      holeText: this.add.text(width / 2, 10, '', {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 12, y: 6 },
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000),

      strokeText: this.add.text(width / 2, 50, '', {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000),

      messageText: this.add.text(width / 2, this.scale.height / 2, '', {
        fontSize: '28px',
        color: '#ffdd00',
        backgroundColor: '#000000cc',
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false),
    };

    // Back to editor button
    const backBtn = this.add.text(10, 10, t('play.backToEditor'), {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('Editor', { courseData: this.courseData });
    });

    backBtn.on('pointerover', () => backBtn.setBackgroundColor('#666666'));
    backBtn.on('pointerout', () => backBtn.setBackgroundColor('#444444'));
  }

  private setupEventListeners(): void {
    EventBus.on('stroke-taken', (count: number) => {
      this.holeStrokes[this.currentHoleIndex] = count;
      this.updateHUD();
    });

    EventBus.on('water-hazard', (count: number) => {
      this.holeStrokes[this.currentHoleIndex] = count;
      this.updateHUD();
      this.showMessage(t('play.waterHazard'), 2000);
    });

    EventBus.on('ball-stopped', () => {
      this.checkHoleCompletion();
    });
  }

  private checkHoleCompletion(): void {
    const hole = this.courseData.holes[this.currentHoleIndex];
    const flagPos = this.isoMap.tileToWorld(hole.flagPosition.tileX, hole.flagPosition.tileY);
    const groundPos = this.ballPhysics.getGroundPosition();

    const distance = Phaser.Math.Distance.Between(groundPos.x, groundPos.y, flagPos.x, flagPos.y);

    if (distance < HOLE_SINK_RADIUS) {
      this.onHoleComplete();
    }
  }

  private onHoleComplete(): void {
    const hole = this.courseData.holes[this.currentHoleIndex];
    const strokes = this.ballPhysics.getStrokeCount();
    this.holeStrokes[this.currentHoleIndex] = strokes;

    const diff = strokes - hole.par;
    let scoreText: string;
    if (diff < 0) {
      scoreText = t('play.underPar', { count: Math.abs(diff) });
    } else if (diff > 0) {
      scoreText = t('play.overPar', { count: diff });
    } else {
      scoreText = t('play.atPar');
    }

    this.showMessage(`${t('play.holeComplete')} ${scoreText}`, 3000);

    // Advance to next hole after delay
    this.time.delayedCall(3000, () => {
      if (this.currentHoleIndex < this.courseData.holes.length - 1) {
        this.currentHoleIndex++;
        this.startHole(this.currentHoleIndex);
      } else {
        this.onCourseComplete();
      }
    });
  }

  private startHole(index: number): void {
    const hole = this.courseData.holes[index];
    const teePos = this.isoMap.tileToWorld(hole.teePosition.tileX, hole.teePosition.tileY);
    this.ballPhysics.moveBallTo(teePos.x, teePos.y);
    this.ballPhysics.resetStrokeCount();
    this.cameras.main.centerOn(teePos.x, teePos.y);
    this.updateHUD();
  }

  private onCourseComplete(): void {
    const totalStrokes = this.holeStrokes.reduce((a, b) => a + b, 0);
    const totalPar = this.courseData.holes.reduce((a, h) => a + h.par, 0);
    const diff = totalStrokes - totalPar;

    let scoreText: string;
    if (diff < 0) {
      scoreText = t('play.underPar', { count: Math.abs(diff) });
    } else if (diff > 0) {
      scoreText = t('play.overPar', { count: diff });
    } else {
      scoreText = t('play.atPar');
    }

    this.showMessage(
      `${t('play.courseComplete')}\n${t('play.totalScore', { score: totalStrokes })} (${scoreText})`,
      0 // stays visible
    );

    // Return to editor after 5 seconds
    this.time.delayedCall(5000, () => {
      this.scene.start('Editor', { courseData: this.courseData });
    });
  }

  private updateHUD(): void {
    if (!this.hud) return;
    const hole = this.courseData.holes[this.currentHoleIndex];
    this.hud.holeText.setText(
      `${t('play.hole', { number: this.currentHoleIndex + 1 })}  |  ${t('play.par', { par: hole.par })}`
    );
    this.hud.strokeText.setText(
      t('play.stroke', { count: this.ballPhysics?.getStrokeCount() ?? 0 })
    );
  }

  private showMessage(text: string, duration: number): void {
    this.hud.messageText.setText(text);
    this.hud.messageText.setVisible(true);

    if (duration > 0) {
      this.time.delayedCall(duration, () => {
        this.hud.messageText.setVisible(false);
      });
    }
  }

  private renderHoleMarkers(): void {
    for (const hole of this.courseData.holes) {
      // Flag on green
      const flagPos = this.isoMap.tileToWorld(hole.flagPosition.tileX, hole.flagPosition.tileY);
      this.markerGraphics.lineStyle(2, 0x333333, 1);
      this.markerGraphics.lineBetween(flagPos.x, flagPos.y, flagPos.x, flagPos.y - 18);
      this.markerGraphics.fillStyle(0xff0000, 1);
      this.markerGraphics.fillTriangle(
        flagPos.x, flagPos.y - 18,
        flagPos.x + 12, flagPos.y - 13,
        flagPos.x, flagPos.y - 8
      );

      // Tee marker
      const teePos = this.isoMap.tileToWorld(hole.teePosition.tileX, hole.teePosition.tileY);
      this.markerGraphics.lineStyle(2, 0xffffff, 0.8);
      this.markerGraphics.lineBetween(teePos.x - 6, teePos.y - 10, teePos.x + 6, teePos.y - 10);
      this.markerGraphics.lineBetween(teePos.x, teePos.y - 10, teePos.x, teePos.y);
    }
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.ballPhysics.update(delta);
    this.aimingSystem.update();

    // Follow ball's ground position while in motion
    if (!this.ballPhysics.isStopped()) {
      const groundPos = this.ballPhysics.getGroundPosition();
      this.cameras.main.centerOn(groundPos.x, groundPos.y);
    }
  }

  shutdown(): void {
    EventBus.removeAllListeners();
    this.ballPhysics.destroy();
    this.aimingSystem.destroy();
  }
}
