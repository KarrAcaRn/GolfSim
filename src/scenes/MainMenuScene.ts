import Phaser from 'phaser';
import { t, setLocale, getLocale, getAvailableLocales } from '../i18n/i18n';
import { Button } from '../ui/Button';

export class MainMenuScene extends Phaser.Scene {
  private buttons: Button[] = [];

  constructor() {
    super({ key: 'MainMenu' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.cameras.main.setBackgroundColor('#1a3d1a');

    // Title
    const title = this.add.text(width / 2, height * 0.25, t('menu.title'), {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, title.y + 60, 'Golf Course Tycoon', {
      fontSize: '18px',
      color: '#88bb88',
    }).setOrigin(0.5);

    const btnWidth = 220;
    const btnHeight = 40;
    const startY = height * 0.5;
    const gap = 12;

    // New Course button
    const newBtn = new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: startY,
      width: btnWidth,
      height: btnHeight,
      text: t('menu.newCourse'),
      fontSize: '16px',
      bgColor: 0x2d7a2d,
      hoverColor: 0x3d9a3d,
      onClick: () => this.scene.start('Editor'),
    });
    this.buttons.push(newBtn);

    // Load Course button
    const loadBtn = new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: startY + btnHeight + gap,
      width: btnWidth,
      height: btnHeight,
      text: t('menu.loadCourse'),
      fontSize: '16px',
      bgColor: 0x444444,
      hoverColor: 0x666666,
      onClick: () => {
        // Will be implemented with save/load system
        this.scene.start('Editor');
      },
    });
    this.buttons.push(loadBtn);

    // Language toggle
    const langBtn = new Button(this, {
      x: width / 2 - btnWidth / 2,
      y: startY + (btnHeight + gap) * 2,
      width: btnWidth,
      height: btnHeight,
      text: `${t('menu.language')}: ${getLocale().toUpperCase()}`,
      fontSize: '16px',
      bgColor: 0x444444,
      hoverColor: 0x666666,
      onClick: () => {
        const locales = getAvailableLocales();
        const currentIndex = locales.indexOf(getLocale());
        const nextLocale = locales[(currentIndex + 1) % locales.length];
        setLocale(nextLocale);
        // Recreate the scene to refresh all text
        this.scene.restart();
      },
    });
    this.buttons.push(langBtn);
  }
}
