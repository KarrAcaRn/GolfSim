import Phaser from 'phaser';
import { Button } from './Button';
import { t } from '../i18n/i18n';
import { EventBus } from '../utils/EventBus';

const MENU_WIDTH = 160;
const MENU_DEPTH = 200;
const BUTTON_HEIGHT = 28;
const BUTTON_MARGIN = 4;

export class OptionsMenu {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private visible = false;
  private menuX: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Position on the right side
    this.menuX = scene.scale.width - MENU_WIDTH - 12;
    this.createMenu();
    this.setVisible(false);
  }

  private addElement<T extends Phaser.GameObjects.GameObject>(el: T, depth = MENU_DEPTH): T {
    this.elements.push(el);
    if ('setScrollFactor' in el) (el as any).setScrollFactor(0);
    if ('setDepth' in el) (el as any).setDepth(depth);
    return el;
  }

  private createMenu(): void {
    let y = 4;

    // Background panel
    this.addElement(
      this.scene.add.rectangle(this.menuX - 4, 0, MENU_WIDTH + 8, 130, 0x1a1a2e, 0.95)
        .setOrigin(0, 0)
    );

    // Title
    this.addElement(
      this.scene.add.text(this.menuX + MENU_WIDTH / 2, y + 6, t('editor.optionsMenu.title' as any), {
        fontSize: '13px',
        color: '#ffcc00',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0),
      MENU_DEPTH + 1
    );
    y += 30;

    // Save button
    const saveBtn = new Button(this.scene, {
      x: this.menuX,
      y,
      width: MENU_WIDTH,
      height: BUTTON_HEIGHT,
      text: t('editor.toolbar.save' as any),
      fontSize: '11px',
      bgColor: 0x2a2a44,
      hoverColor: 0x44446a,
      onClick: () => {
        EventBus.emit('editor-save');
      },
    });
    saveBtn.setDepth(MENU_DEPTH + 1);
    this.buttons.push(saveBtn);
    y += BUTTON_HEIGHT + BUTTON_MARGIN;

    // Load button
    const loadBtn = new Button(this.scene, {
      x: this.menuX,
      y,
      width: MENU_WIDTH,
      height: BUTTON_HEIGHT,
      text: t('editor.toolbar.load' as any),
      fontSize: '11px',
      bgColor: 0x2a2a44,
      hoverColor: 0x44446a,
      onClick: () => {
        EventBus.emit('editor-load');
      },
    });
    loadBtn.setDepth(MENU_DEPTH + 1);
    this.buttons.push(loadBtn);
  }

  show(): void {
    this.visible = true;
    this.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.setVisible(false);
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isOpen(): boolean {
    return this.visible;
  }

  private setVisible(vis: boolean): void {
    for (const el of this.elements) {
      if ('setVisible' in el) (el as any).setVisible(vis);
    }
    for (const btn of this.buttons) {
      btn.setVisible(vis);
    }
  }

  destroy(): void {
    for (const btn of this.buttons) {
      btn.destroy();
    }
    for (const el of this.elements) {
      if (!el.scene) continue;
      el.destroy();
    }
    this.elements = [];
    this.buttons = [];
  }
}
