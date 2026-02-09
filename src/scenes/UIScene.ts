import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { EditorTool } from '../editor/EditorState';
import { t } from '../i18n/i18n';
import { EventBus } from '../utils/EventBus';

interface UISceneData {
  mode: 'editor' | 'play';
}

const TOOLBAR_WIDTH = 140;
const BUTTON_HEIGHT = 28;
const BUTTON_MARGIN = 4;

export class UIScene extends Phaser.Scene {
  private mode: 'editor' | 'play' = 'editor';
  private buttons: Button[] = [];
  private terrainButtons: Map<TileType, Button> = new Map();
  private toolButtons: Map<string, Button> = new Map();
  private infoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UI' });
  }

  create(data: UISceneData): void {
    this.mode = data?.mode ?? 'editor';
    this.clearUI();

    if (this.mode === 'editor') {
      this.createEditorToolbar();
    } else {
      this.createPlayHUD();
    }
  }

  private clearUI(): void {
    this.buttons.forEach(b => b.destroy());
    this.buttons = [];
    this.terrainButtons.clear();
    this.toolButtons.clear();
  }

  private createEditorToolbar(): void {
    const { height } = this.scale;
    const x = 4;
    let y = 4;

    // Background panel
    const panel = this.add.rectangle(0, 0, TOOLBAR_WIDTH + 8, height, 0x222222, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Title
    this.add.text(TOOLBAR_WIDTH / 2 + 4, y + 6, t('editor.terrain'), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    y += 28;

    // Terrain buttons
    const terrainKeys: { type: TileType; key: string }[] = [
      { type: TileType.GRASS, key: 'editor.toolbar.grass' },
      { type: TileType.FAIRWAY, key: 'editor.toolbar.fairway' },
      { type: TileType.GREEN, key: 'editor.toolbar.green' },
      { type: TileType.SAND, key: 'editor.toolbar.sand' },
      { type: TileType.WATER, key: 'editor.toolbar.water' },
      { type: TileType.ROUGH, key: 'editor.toolbar.rough' },
      { type: TileType.TEE, key: 'editor.toolbar.tee' },
    ];

    for (const { type, key } of terrainKeys) {
      const props = TILE_PROPERTIES[type];

      // Color swatch
      this.add.rectangle(x + 4, y + BUTTON_HEIGHT / 2, 16, 16, props.color)
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(102);

      const btn = new Button(this, {
        x: x + 24,
        y,
        width: TOOLBAR_WIDTH - 28,
        height: BUTTON_HEIGHT,
        text: `${t(key as any)} (${type + 1})`,
        fontSize: '11px',
        bgColor: 0x333333,
        hoverColor: 0x555555,
        onClick: () => {
          EventBus.emit('editor-select-terrain', type);
          this.updateTerrainHighlight(type);
        },
      });
      btn.setDepth(101);
      this.buttons.push(btn);
      this.terrainButtons.set(type, btn);
      y += BUTTON_HEIGHT + BUTTON_MARGIN;
    }

    // Default selection
    this.updateTerrainHighlight(TileType.FAIRWAY);

    y += 10;

    // Separator
    this.add.rectangle(x, y, TOOLBAR_WIDTH, 1, 0x666666)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    y += 8;

    // Tool label
    this.add.text(TOOLBAR_WIDTH / 2 + 4, y, t('editor.tool'), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    y += 22;

    // Tool buttons
    const tools: { id: string; key: string; tool: EditorTool }[] = [
      { id: 'paint', key: 'editor.toolbar.paint', tool: EditorTool.PAINT_TERRAIN },
      { id: 'erase', key: 'editor.toolbar.erase', tool: EditorTool.ERASE },
      { id: 'hole', key: 'editor.toolbar.placeHole', tool: EditorTool.PLACE_HOLE },
    ];

    for (const { id, key, tool } of tools) {
      const btn = new Button(this, {
        x,
        y,
        width: TOOLBAR_WIDTH,
        height: BUTTON_HEIGHT,
        text: t(key as any),
        fontSize: '11px',
        bgColor: 0x333333,
        hoverColor: 0x555555,
        onClick: () => {
          EventBus.emit('editor-select-tool', tool);
          this.updateToolHighlight(id);
        },
      });
      btn.setDepth(101);
      this.buttons.push(btn);
      this.toolButtons.set(id, btn);
      y += BUTTON_HEIGHT + BUTTON_MARGIN;
    }

    this.updateToolHighlight('paint');

    y += 10;

    // Separator
    this.add.rectangle(x, y, TOOLBAR_WIDTH, 1, 0x666666)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    y += 8;

    // Action buttons
    const actions: { key: string; event: string }[] = [
      { key: 'editor.toolbar.save', event: 'editor-save' },
      { key: 'editor.toolbar.load', event: 'editor-load' },
      { key: 'editor.toolbar.play', event: 'editor-play' },
    ];

    for (const { key, event } of actions) {
      const btn = new Button(this, {
        x,
        y,
        width: TOOLBAR_WIDTH,
        height: BUTTON_HEIGHT,
        text: t(key as any),
        fontSize: '11px',
        bgColor: event === 'editor-play' ? 0x2d7a2d : 0x333333,
        hoverColor: event === 'editor-play' ? 0x3d9a3d : 0x555555,
        onClick: () => EventBus.emit(event),
      });
      btn.setDepth(101);
      this.buttons.push(btn);
      y += BUTTON_HEIGHT + BUTTON_MARGIN;
    }

    // Info text at bottom
    this.infoText = this.add.text(TOOLBAR_WIDTH / 2 + 4, height - 20, '', {
      fontSize: '10px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(101);
  }

  private createPlayHUD(): void {
    // Play mode HUD will be implemented in Phase 9
    const { width } = this.scale;

    this.infoText = this.add.text(width / 2, 20, '', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    // Back to editor button
    const btn = new Button(this, {
      x: 10,
      y: 10,
      width: 120,
      height: 30,
      text: t('play.backToEditor'),
      fontSize: '11px',
      bgColor: 0x444444,
      hoverColor: 0x666666,
      onClick: () => EventBus.emit('play-back-to-editor'),
    });
    btn.setDepth(101);
    this.buttons.push(btn);
  }

  private updateTerrainHighlight(type: TileType): void {
    this.terrainButtons.forEach((btn, t) => btn.setActive(t === type));
  }

  private updateToolHighlight(id: string): void {
    this.toolButtons.forEach((btn, t) => btn.setActive(t === id));
  }

  setInfoText(text: string): void {
    if (this.infoText) {
      this.infoText.setText(text);
    }
  }
}
