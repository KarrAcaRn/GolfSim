import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { BuildMenu } from '../ui/BuildMenu';
import { OptionsMenu } from '../ui/OptionsMenu';
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
  private infoText!: Phaser.GameObjects.Text;
  private buildMenu?: BuildMenu;
  private optionsMenu?: OptionsMenu;

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
    if (this.buildMenu) {
      this.buildMenu.destroy();
      this.buildMenu = undefined;
    }
    if (this.optionsMenu) {
      this.optionsMenu.destroy();
      this.optionsMenu = undefined;
    }
  }

  private createEditorToolbar(): void {
    const { height } = this.scale;
    const x = 4;
    let y = 4;

    // Background panel (smaller now)
    this.add.rectangle(0, 0, TOOLBAR_WIDTH + 8, height, 0x222222, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Build Menu button
    const buildBtn = new Button(this, {
      x,
      y,
      width: TOOLBAR_WIDTH,
      height: BUTTON_HEIGHT + 4,
      text: t('editor.buildMenu.title' as any),
      fontSize: '12px',
      bgColor: 0x2a2a44,
      hoverColor: 0x44446a,
      onClick: () => this.buildMenu?.toggle(),
    });
    buildBtn.setDepth(101);
    this.buttons.push(buildBtn);
    y += BUTTON_HEIGHT + BUTTON_MARGIN + 4;

    // Options Menu button
    const optionsBtn = new Button(this, {
      x,
      y,
      width: TOOLBAR_WIDTH,
      height: BUTTON_HEIGHT + 4,
      text: t('editor.optionsMenu.title' as any),
      fontSize: '12px',
      bgColor: 0x2a2a44,
      hoverColor: 0x44446a,
      onClick: () => this.optionsMenu?.toggle(),
    });
    optionsBtn.setDepth(101);
    this.buttons.push(optionsBtn);
    y += BUTTON_HEIGHT + BUTTON_MARGIN + 4;

    y += 6;

    // Separator
    this.add.rectangle(x, y, TOOLBAR_WIDTH, 1, 0x666666)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    y += 8;

    // Play button
    const playBtn = new Button(this, {
      x,
      y,
      width: TOOLBAR_WIDTH,
      height: BUTTON_HEIGHT,
      text: t('editor.toolbar.play' as any),
      fontSize: '11px',
      bgColor: 0x2d7a2d,
      hoverColor: 0x3d9a3d,
      onClick: () => EventBus.emit('editor-play'),
    });
    playBtn.setDepth(101);
    this.buttons.push(playBtn);

    // Info text at bottom
    this.infoText = this.add.text(TOOLBAR_WIDTH / 2 + 4, height - 20, '', {
      fontSize: '10px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(101);

    // Build menu (initially hidden, toggled with B)
    this.buildMenu = new BuildMenu(this);

    // Options menu (initially hidden, toggled with O)
    this.optionsMenu = new OptionsMenu(this);

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-B', () => {
      this.buildMenu?.toggle();
    });
    this.input.keyboard?.on('keydown-O', () => {
      this.optionsMenu?.toggle();
    });
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

  setInfoText(text: string): void {
    if (this.infoText) {
      this.infoText.setText(text);
    }
  }
}
