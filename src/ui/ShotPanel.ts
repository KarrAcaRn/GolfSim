import Phaser from 'phaser';
import { CLUBS, Club } from '../models/Club';
import { EventBus } from '../utils/EventBus';
import { t, TranslationKey } from '../i18n/i18n';

export class ShotPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private clubButtons: Phaser.GameObjects.Text[] = [];
  private spinButtons: Phaser.GameObjects.Container[] = [];
  private selectedClubIndex: number = 2; // Iron default
  private selectedSpin: number = 0; // -1, 0, +1

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000);
    this.createPanel();
  }

  private createPanel(): void {
    const { width, height } = this.scene.scale;
    const panelW = 200;
    const panelH = 240;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x888888, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(panelX + panelW / 2, panelY + 10, t('shotPanel.title'), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Club buttons (5 clubs, vertically stacked)
    const clubStartY = panelY + 35;
    for (let i = 0; i < CLUBS.length; i++) {
      const club = CLUBS[i];
      const btn = this.scene.add.text(panelX + panelW / 2, clubStartY + i * 28, `${i + 1}. ${t(club.nameKey as TranslationKey)}`, {
        fontSize: '13px',
        color: '#aaaaaa',
        backgroundColor: '#333333',
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => this.selectClub(i));
      btn.on('pointerover', () => { if (i !== this.selectedClubIndex) btn.setBackgroundColor('#555555'); });
      btn.on('pointerout', () => { if (i !== this.selectedClubIndex) btn.setBackgroundColor('#333333'); });

      this.clubButtons.push(btn);
      this.container.add(btn);
    }

    // Spin section
    const spinY = clubStartY + CLUBS.length * 28 + 10;
    const spinLabel = this.scene.add.text(panelX + panelW / 2, spinY, t('shotPanel.spin'), {
      fontSize: '12px',
      color: '#cccccc',
    }).setOrigin(0.5, 0);
    this.container.add(spinLabel);

    // Three spin buttons side by side
    const spinBtnY = spinY + 20;
    const spinBtnW = 50;
    const spinSpacing = 8;
    const totalSpinW = spinBtnW * 3 + spinSpacing * 2;
    const spinStartX = panelX + (panelW - totalSpinW) / 2;

    const spinOptions = [
      { dir: -1, label: '↰' },   // left curved arrow
      { dir: 0,  label: '↑' },   // straight arrow
      { dir: 1,  label: '↱' },   // right curved arrow
    ];

    for (let i = 0; i < spinOptions.length; i++) {
      const opt = spinOptions[i];
      const btnX = spinStartX + i * (spinBtnW + spinSpacing);

      const btnBg = this.scene.add.graphics();
      const btnText = this.scene.add.text(btnX + spinBtnW / 2, spinBtnY + 14, opt.label, {
        fontSize: '20px',
        color: '#aaaaaa',
      }).setOrigin(0.5, 0.5);

      const hitArea = this.scene.add.rectangle(btnX + spinBtnW / 2, spinBtnY + 14, spinBtnW, 28)
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5, 0.5);
      hitArea.setAlpha(0.001); // invisible but clickable

      hitArea.on('pointerdown', () => this.selectSpin(opt.dir));

      const btnContainer = this.scene.add.container(0, 0, [btnBg, btnText, hitArea]);
      this.spinButtons.push(btnContainer);
      this.container.add(btnContainer);

      // Store references for updating
      (btnContainer as any)._bg = btnBg;
      (btnContainer as any)._text = btnText;
      (btnContainer as any)._dir = opt.dir;
      (btnContainer as any)._x = btnX;
      (btnContainer as any)._y = spinBtnY;
      (btnContainer as any)._w = spinBtnW;
    }

    this.updateClubHighlight();
    this.updateSpinHighlight();
  }

  private selectClub(index: number): void {
    this.selectedClubIndex = index;
    this.updateClubHighlight();
    EventBus.emit('club-changed', index);
  }

  private selectSpin(direction: number): void {
    this.selectedSpin = direction;
    this.updateSpinHighlight();
  }

  private updateClubHighlight(): void {
    for (let i = 0; i < this.clubButtons.length; i++) {
      if (i === this.selectedClubIndex) {
        this.clubButtons[i].setColor('#ffffff');
        this.clubButtons[i].setBackgroundColor('#227722');
      } else {
        this.clubButtons[i].setColor('#aaaaaa');
        this.clubButtons[i].setBackgroundColor('#333333');
      }
    }
  }

  private updateSpinHighlight(): void {
    for (const btnContainer of this.spinButtons) {
      const bg = (btnContainer as any)._bg as Phaser.GameObjects.Graphics;
      const text = (btnContainer as any)._text as Phaser.GameObjects.Text;
      const dir = (btnContainer as any)._dir as number;
      const x = (btnContainer as any)._x as number;
      const y = (btnContainer as any)._y as number;
      const w = (btnContainer as any)._w as number;

      bg.clear();
      if (dir === this.selectedSpin) {
        bg.fillStyle(0x227722, 1);
        bg.fillRoundedRect(x, y, w, 28, 4);
        text.setColor('#ffffff');
      } else {
        bg.fillStyle(0x333333, 1);
        bg.fillRoundedRect(x, y, w, 28, 4);
        text.setColor('#aaaaaa');
      }
    }
  }

  getSelectedClubIndex(): number {
    return this.selectedClubIndex;
  }

  getSelectedSpin(): number {
    return this.selectedSpin;
  }

  setSelectedClubIndex(index: number): void {
    this.selectedClubIndex = Math.max(0, Math.min(CLUBS.length - 1, index));
    this.updateClubHighlight();
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
