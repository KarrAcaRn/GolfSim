import Phaser from 'phaser';
import { Button } from './Button';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { EditorTool } from '../editor/EditorState';
import { t } from '../i18n/i18n';
import { EventBus } from '../utils/EventBus';

const MENU_WIDTH = 160;
const MENU_X = 4;
const MENU_DEPTH = 200;
const BUTTON_HEIGHT = 26;
const BUTTON_MARGIN = 3;

export class BuildMenu {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
    const { height } = this.scene.scale;
    let y = 4;

    // Background panel
    this.addElement(
      this.scene.add.rectangle(0, 0, MENU_WIDTH + 8, height, 0x1a1a2e, 0.95)
        .setOrigin(0, 0)
    );

    // Title
    this.addElement(
      this.scene.add.text(MENU_WIDTH / 2 + 4, y + 6, t('editor.buildMenu.title' as any), {
        fontSize: '13px',
        color: '#ffcc00',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0),
      MENU_DEPTH + 1
    );
    y += 30;

    // === Terrain Category ===
    this.addElement(
      this.scene.add.rectangle(MENU_X, y, MENU_WIDTH, 22, 0x333355, 1)
        .setOrigin(0, 0),
      MENU_DEPTH + 1
    );
    this.addElement(
      this.scene.add.text(MENU_X + 6, y + 3, `▼ ${t('editor.buildMenu.terrain' as any)}`, {
        fontSize: '12px',
        color: '#aabbff',
        fontStyle: 'bold',
      }).setOrigin(0, 0),
      MENU_DEPTH + 2
    );
    y += 26;

    // Terrain buttons
    const terrainKeys: { type: TileType; key: string; shortcut: number }[] = [
      { type: TileType.GRASS, key: 'editor.toolbar.grass', shortcut: 1 },
      { type: TileType.FAIRWAY, key: 'editor.toolbar.fairway', shortcut: 2 },
      { type: TileType.GREEN, key: 'editor.toolbar.green', shortcut: 3 },
      { type: TileType.SAND, key: 'editor.toolbar.sand', shortcut: 4 },
      { type: TileType.WATER, key: 'editor.toolbar.water', shortcut: 5 },
      { type: TileType.ROUGH, key: 'editor.toolbar.rough', shortcut: 6 },
      { type: TileType.TEE, key: 'editor.toolbar.tee', shortcut: 7 },
    ];

    for (const { type, key, shortcut } of terrainKeys) {
      const props = TILE_PROPERTIES[type];

      // Color swatch
      this.addElement(
        this.scene.add.rectangle(MENU_X + 6, y + BUTTON_HEIGHT / 2, 14, 14, props.color)
          .setOrigin(0, 0.5),
        MENU_DEPTH + 2
      );

      const btn = new Button(this.scene, {
        x: MENU_X + 24,
        y,
        width: MENU_WIDTH - 28,
        height: BUTTON_HEIGHT,
        text: `${t(key as any)} (${shortcut})`,
        fontSize: '11px',
        bgColor: 0x2a2a44,
        hoverColor: 0x44446a,
        onClick: () => {
          EventBus.emit('editor-select-terrain', type);
          EventBus.emit('editor-select-tool', EditorTool.PAINT_TERRAIN);
          this.hide();
        },
      });
      btn.setDepth(MENU_DEPTH + 1);
      this.buttons.push(btn);
      y += BUTTON_HEIGHT + BUTTON_MARGIN;
    }

    y += 6;

    // === Modify Terrain Category ===
    this.addElement(
      this.scene.add.rectangle(MENU_X, y, MENU_WIDTH, 22, 0x333355, 1)
        .setOrigin(0, 0),
      MENU_DEPTH + 1
    );
    this.addElement(
      this.scene.add.text(MENU_X + 6, y + 3, `▼ ${t('editor.buildMenu.modifyTerrain' as any)}`, {
        fontSize: '12px',
        color: '#aabbff',
        fontStyle: 'bold',
      }).setOrigin(0, 0),
      MENU_DEPTH + 2
    );
    y += 26;

    // Raise button
    const raiseBtn = new Button(this.scene, {
      x: MENU_X + 4,
      y,
      width: MENU_WIDTH - 8,
      height: BUTTON_HEIGHT,
      text: t('editor.buildMenu.raise' as any),
      fontSize: '11px',
      bgColor: 0x2a4a2a,
      hoverColor: 0x3a6a3a,
      onClick: () => {
        EventBus.emit('editor-select-tool', EditorTool.RAISE_TERRAIN);
        this.hide();
      },
    });
    raiseBtn.setDepth(MENU_DEPTH + 1);
    this.buttons.push(raiseBtn);
    y += BUTTON_HEIGHT + BUTTON_MARGIN;

    // Lower button
    const lowerBtn = new Button(this.scene, {
      x: MENU_X + 4,
      y,
      width: MENU_WIDTH - 8,
      height: BUTTON_HEIGHT,
      text: t('editor.buildMenu.lower' as any),
      fontSize: '11px',
      bgColor: 0x4a2a2a,
      hoverColor: 0x6a3a3a,
      onClick: () => {
        EventBus.emit('editor-select-tool', EditorTool.LOWER_TERRAIN);
        this.hide();
      },
    });
    lowerBtn.setDepth(MENU_DEPTH + 1);
    this.buttons.push(lowerBtn);
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
