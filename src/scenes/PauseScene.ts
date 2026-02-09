import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { t, setLocale, getLocale, getAvailableLocales } from '../i18n/i18n';

export class PauseScene extends Phaser.Scene {
  private buttons: Button[] = [];
  private callingScene: string = 'Editor';

  constructor() {
    super({ key: 'Pause' });
  }

  create(data: { callingScene?: string }): void {
    this.callingScene = data?.callingScene ?? 'Editor';

    const { width, height } = this.scale;

    // Dim background
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setScrollFactor(0);

    // Pause panel
    const panelWidth = 300;
    const panelHeight = 280;
    this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x222222, 0.95)
      .setStrokeStyle(2, 0x888888)
      .setScrollFactor(0);

    // Title
    this.add.text(width / 2, height / 2 - 100, 'Pause', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);

    const btnWidth = 200;
    const btnHeight = 36;
    const startY = height / 2 - 40;
    const gap = 10;

    // Resume
    this.buttons.push(new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: startY,
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

    // Language toggle
    this.buttons.push(new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: startY + btnHeight + gap,
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

    // Quit to menu
    this.buttons.push(new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: startY + (btnHeight + gap) * 2,
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
