import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { t, setLocale, getLocale, getAvailableLocales } from '../i18n/i18n';
import { EventBus } from '../utils/EventBus';

export class PauseScene extends Phaser.Scene {
  private buttons: Button[] = [];
  private callingScene: string = 'Editor';

  constructor() {
    super({ key: 'Pause' });
  }

  create(data: { callingScene?: string }): void {
    this.callingScene = data?.callingScene ?? 'Editor';
    const isEditor = this.callingScene === 'Editor';

    const { width, height } = this.scale;

    // Dim background
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setScrollFactor(0);

    const btnWidth = 200;
    const btnHeight = 36;
    const gap = 10;

    // Count buttons to calculate panel size
    const buttonCount = isEditor ? 5 : 3; // Resume, [Save, Load], Language, Menu
    const panelHeight = 100 + buttonCount * (btnHeight + gap);

    // Pause panel
    this.add.rectangle(width / 2, height / 2, 300, panelHeight, 0x222222, 0.95)
      .setStrokeStyle(2, 0x888888)
      .setScrollFactor(0);

    // Title
    this.add.text(width / 2, height / 2 - panelHeight / 2 + 30, 'Pause', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);

    let btnY = height / 2 - panelHeight / 2 + 70;

    // Resume
    this.buttons.push(new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      text: 'Resume',
      fontSize: '14px',
      bgColor: 0x2d7a2d,
      hoverColor: 0x3d9a3d,
      onClick: () => {
        this.scene.stop();
        this.scene.resume(this.callingScene);
      },
    }));
    btnY += btnHeight + gap;

    // Save & Load — only in editor mode
    if (isEditor) {
      this.buttons.push(new Button(this, {
        x: width / 2 - btnWidth / 2,
        y: btnY,
        width: btnWidth,
        height: btnHeight,
        text: t('editor.toolbar.save' as any),
        fontSize: '14px',
        bgColor: 0x444444,
        hoverColor: 0x666666,
        onClick: () => {
          EventBus.emit('editor-save');
        },
      }));
      btnY += btnHeight + gap;

      this.buttons.push(new Button(this, {
        x: width / 2 - btnWidth / 2,
        y: btnY,
        width: btnWidth,
        height: btnHeight,
        text: t('editor.toolbar.load' as any),
        fontSize: '14px',
        bgColor: 0x444444,
        hoverColor: 0x666666,
        onClick: () => {
          EventBus.emit('editor-load');
        },
      }));
      btnY += btnHeight + gap;
    }

    // Language toggle
    this.buttons.push(new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      text: `${t('menu.language')}: ${getLocale().toUpperCase()}`,
      fontSize: '14px',
      bgColor: 0x444444,
      hoverColor: 0x666666,
      onClick: () => {
        const locales = getAvailableLocales();
        const idx = locales.indexOf(getLocale());
        setLocale(locales[(idx + 1) % locales.length]);
        this.scene.restart({ callingScene: this.callingScene });
      },
    }));
    btnY += btnHeight + gap;

    // Quit to menu
    this.buttons.push(new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      text: 'Main Menu',
      fontSize: '14px',
      bgColor: 0x663333,
      hoverColor: 0x884444,
      onClick: () => {
        this.scene.stop(this.callingScene);
        this.scene.stop('UI');
        this.scene.stop();
        this.scene.start('MainMenu');
      },
    }));

    // ESC to resume
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.stop();
      this.scene.resume(this.callingScene);
    });
  }
}
