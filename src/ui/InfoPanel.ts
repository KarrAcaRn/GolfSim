import Phaser from 'phaser';
import { GuestSkills } from '../models/GuestSkills';
import { EventBus } from '../utils/EventBus';
import { t, TranslationKey } from '../i18n/i18n';
import { addUIElement } from '../utils/UIUtils';

const SKILL_KEYS: { key: keyof GuestSkills; labelKey: TranslationKey }[] = [
  { key: 'strength', labelKey: 'info.strength' },
  { key: 'accuracy', labelKey: 'info.accuracy' },
  { key: 'driver', labelKey: 'info.driver' },
  { key: 'wood', labelKey: 'info.wood' },
  { key: 'iron', labelKey: 'info.iron' },
  { key: 'sandWedge', labelKey: 'info.sandWedge' },
  { key: 'putter', labelKey: 'info.putter' },
  { key: 'leftSpin', labelKey: 'info.leftSpin' },
  { key: 'rightSpin', labelKey: 'info.rightSpin' },
];

export class InfoPanel {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private mainCamera?: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setMainCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCamera = camera;
  }

  show(skills: GuestSkills): void {
    this.hide();
    this.visible = true;

    const panelX = 10;
    const panelY = 40;
    const panelW = 220;
    const rowH = 20;
    const panelH = 30 + SKILL_KEYS.length * rowH + 10;

    // Background
    const bg = addUIElement(this.scene.add.graphics(), this.elements, 2000);
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x888888, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    // Title
    addUIElement(this.scene.add.text(panelX + panelW / 2, panelY + 8, t('info.title' as TranslationKey), {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0), this.elements, 2000);

    // Skill rows
    const startY = panelY + 28;
    const barX = panelX + 95;
    const barW = 80;
    const barH = 12;

    for (let i = 0; i < SKILL_KEYS.length; i++) {
      const { key, labelKey } = SKILL_KEYS[i];
      const value = skills[key];
      const y = startY + i * rowH;

      // Label
      addUIElement(this.scene.add.text(panelX + 10, y, t(labelKey), {
        fontSize: '11px',
        color: '#cccccc',
      }).setOrigin(0, 0), this.elements, 2000);

      // Bar background
      const barGfx = addUIElement(this.scene.add.graphics(), this.elements, 2000);
      barGfx.fillStyle(0x333333, 1);
      barGfx.fillRect(barX, y + 1, barW, barH);

      // Bar fill
      const fillW = (value / 100) * barW;
      const color = value < 30 ? 0xcc3333 : value < 60 ? 0xcccc33 : 0x33cc33;
      barGfx.fillStyle(color, 1);
      barGfx.fillRect(barX, y + 1, fillW, barH);

      // Value text
      addUIElement(this.scene.add.text(barX + barW + 6, y, `${value}`, {
        fontSize: '11px',
        color: '#ffffff',
      }).setOrigin(0, 0), this.elements, 2000);
    }

    // Hide from main camera so elements don't zoom
    if (this.mainCamera) {
      for (const el of this.elements) {
        this.mainCamera.ignore(el);
      }
    }
  }

  hide(): void {
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hide();
  }
}
