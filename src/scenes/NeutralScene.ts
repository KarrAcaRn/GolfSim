import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { CameraController } from '../systems/CameraController';
import { CourseData, createEmptyCourse } from '../models/CourseData';
import { MAP_WIDTH, MAP_HEIGHT } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { t } from '../i18n/i18n';
import { createMarkerSprite } from '../utils/UIUtils';
import { GuestManager } from '../guests/GuestManager';
import { InfoPanel } from '../ui/InfoPanel';
import { GuestSkills } from '../models/GuestSkills';

export class NeutralScene extends Phaser.Scene {
  private isoMap!: IsometricMap;
  private cameraController!: CameraController;
  private courseData!: CourseData;
  private guestManager?: GuestManager;
  private infoPanel!: InfoPanel;
  private markerSprites: Phaser.GameObjects.Image[] = [];
  private guestClickedFlag = false;
  private messageText!: Phaser.GameObjects.Text;
  private buildBtn!: Phaser.GameObjects.Text;
  private playBtn!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Neutral' });
  }

  create(data: { courseData?: CourseData }): void {
    this.courseData = data.courseData ?? createEmptyCourse(MAP_WIDTH, MAP_HEIGHT);

    // Create IsometricMap and load courseData
    this.isoMap = new IsometricMap(this, this.courseData.width, this.courseData.height);
    this.isoMap.loadFromData(this.courseData);
    this.isoMap.setGridVisible(false);

    // Set camera bounds and center on map
    const bounds = this.isoMap.getWorldBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    const center = this.isoMap.tileToWorld(
      Math.floor(this.courseData.width / 2),
      Math.floor(this.courseData.height / 2)
    );
    this.cameras.main.centerOn(center.x, center.y);

    // Camera controller
    this.cameraController = new CameraController(this);

    // Guest NPCs (only if holes exist)
    if (this.courseData.holes.length > 0) {
      this.guestManager = new GuestManager(this, this.isoMap);
      this.guestManager.start(this.courseData.holes);
    }

    // Info panel for guest skills
    this.infoPanel = new InfoPanel(this);

    // Render hole markers
    this.renderHoleMarkers();

    // UI buttons
    this.createButtons();

    // Warning message (initially invisible)
    this.messageText = this.add.text(
      this.scale.width / 2, this.scale.height / 2, '',
      {
        fontSize: '28px',
        color: '#ffdd00',
        backgroundColor: '#000000cc',
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

    // ESC → Pause
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.pause();
      this.scene.launch('Pause', { callingScene: 'Neutral' });
    });

    // EventBus listeners
    EventBus.on('guest-selected', (skills: GuestSkills) => {
      this.infoPanel.show(skills);
      this.guestClickedFlag = true;
    });

    EventBus.on('guest-deselected', () => {
      this.infoPanel.hide();
    });

    // Click on empty space hides info panel
    this.input.on('pointerdown', () => {
      if (!this.guestClickedFlag && this.infoPanel.isVisible()) {
        EventBus.emit('guest-deselected');
      }
      this.guestClickedFlag = false;
    });

    // UI camera so buttons/message don't scale with zoom
    this.setupUICamera();
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.guestManager?.update(delta);
  }

  shutdown(): void {
    this.guestManager?.destroy();
    this.infoPanel.destroy();
    this.markerSprites.forEach(s => s.destroy());
    this.markerSprites = [];
    EventBus.removeAllListeners();
  }

  private setupUICamera(): void {
    const { width, height } = this.scale;
    const uiCamera = this.cameras.add(0, 0, width, height);

    const uiElements: Phaser.GameObjects.GameObject[] = [
      this.buildBtn,
      this.playBtn,
      this.messageText,
    ];

    // Main camera ignores UI → they won't zoom
    this.cameras.main.ignore(uiElements);

    // UI camera ignores all world objects → no double rendering
    for (const obj of this.children.list) {
      if (!uiElements.includes(obj)) {
        uiCamera.ignore(obj);
      }
    }

    // InfoPanel creates elements dynamically — ignore from main camera
    this.infoPanel.setMainCameraIgnore(this.cameras.main);
  }

  private renderHoleMarkers(): void {
    this.markerSprites.forEach(s => s.destroy());
    this.markerSprites = [];

    for (const hole of this.courseData.holes) {
      const cupSprite = createMarkerSprite(this, this.isoMap, hole.flagPosition, 'cup');
      this.markerSprites.push(cupSprite);

      const flagSprite = createMarkerSprite(this, this.isoMap, hole.flagPosition, 'flag');
      this.markerSprites.push(flagSprite);

      const teeSprite = createMarkerSprite(this, this.isoMap, hole.teePosition, 'tee_marker');
      this.markerSprites.push(teeSprite);
    }
  }

  private createButtons(): void {
    // "Build" button
    this.buildBtn = this.add.text(10, 10, t('neutral.build'), {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });

    this.buildBtn.on('pointerdown', () => {
      this.scene.start('Editor', { courseData: this.courseData });
    });
    this.buildBtn.on('pointerover', () => this.buildBtn.setBackgroundColor('#666666'));
    this.buildBtn.on('pointerout', () => this.buildBtn.setBackgroundColor('#444444'));

    // "Play" button
    this.playBtn = this.add.text(10, 42, t('neutral.play'), {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });

    this.playBtn.on('pointerdown', () => {
      if (this.courseData.holes.length > 0) {
        this.scene.start('Play', { courseData: this.courseData });
      } else {
        this.showWarning();
      }
    });
    this.playBtn.on('pointerover', () => this.playBtn.setBackgroundColor('#666666'));
    this.playBtn.on('pointerout', () => this.playBtn.setBackgroundColor('#444444'));
  }

  private showWarning(): void {
    this.messageText.setText(t('neutral.needHoles'));
    this.messageText.setVisible(true);
    this.time.delayedCall(2000, () => {
      this.messageText.setVisible(false);
    });
  }
}
