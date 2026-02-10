import Phaser from 'phaser';
import { CLUBS } from '../models/Club';
import { EventBus } from '../utils/EventBus';
import { t, TranslationKey } from '../i18n/i18n';

export class ShotPanel {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private clubButtons: Phaser.GameObjects.Text[] = [];
  private spinBgs: Phaser.GameObjects.Graphics[] = [];
  private spinTexts: Phaser.GameObjects.Text[] = [];
  private spinDirs: number[] = [];
  private spinPositions: { x: number; y: number; w: number }[] = [];
  private selectedClubIndex: number = 2;
  private selectedSpin: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPanel();
  }

  private addElement<T extends Phaser.GameObjects.GameObject>(el: T): T {
    this.elements.push(el);
    if ('setScrollFactor' in el) (el as any).setScrollFactor(0);
    if ('setDepth' in el) (el as any).setDepth(2000);
    return el;
  }

  private createPanel(): void {
    const { width, height } = this.scene.scale;
    const panelW = 200;
    const panelH = 240;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    // Background
    const bg = this.addElement(this.scene.add.graphics());
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x888888, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    // Title
    this.addElement(this.scene.add.text(panelX + panelW / 2, panelY + 10, t('shotPanel.title'), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Club buttons
    const clubStartY = panelY + 35;
    for (let i = 0; i < CLUBS.length; i++) {
      const club = CLUBS[i];
      const btn = this.addElement(this.scene.add.text(
        panelX + panelW / 2, clubStartY + i * 28,
        `${i + 1}. ${t(club.nameKey as TranslationKey)}`,
        { fontSize: '13px', color: '#aaaaaa', backgroundColor: '#333333', padding: { x: 6, y: 3 } }
      ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }));

      const idx = i;
      btn.on('pointerdown', () => this.selectClub(idx));
      btn.on('pointerover', () => { if (idx !== this.selectedClubIndex) btn.setBackgroundColor('#555555'); });
      btn.on('pointerout', () => { if (idx !== this.selectedClubIndex) btn.setBackgroundColor('#333333'); });

      this.clubButtons.push(btn);
    }

    // Spin label
    const spinY = clubStartY + CLUBS.length * 28 + 10;
    this.addElement(this.scene.add.text(panelX + panelW / 2, spinY, t('shotPanel.spin'), {
      fontSize: '12px', color: '#cccccc',
    }).setOrigin(0.5, 0));

    // Spin buttons - NO containers, just individual elements
    const spinBtnY = spinY + 20;
    const spinBtnW = 50;
    const spinSpacing = 8;
    const totalSpinW = spinBtnW * 3 + spinSpacing * 2;
    const spinStartX = panelX + (panelW - totalSpinW) / 2;

    const spinOptions = [
      { dir: -1, label: '↰' },
      { dir: 0,  label: '↑' },
      { dir: 1,  label: '↱' },
    ];

    for (let i = 0; i < spinOptions.length; i++) {
      const opt = spinOptions[i];
      const btnX = spinStartX + i * (spinBtnW + spinSpacing);

      // Background graphics for this spin button
      const sBg = this.addElement(this.scene.add.graphics());
      this.spinBgs.push(sBg);

      // Text
      const sText = this.addElement(this.scene.add.text(
        btnX + spinBtnW / 2, spinBtnY + 14, opt.label,
        { fontSize: '20px', color: '#aaaaaa' }
      ).setOrigin(0.5, 0.5));
      this.spinTexts.push(sText);

      // Invisible clickable rectangle (NOT in a container)
      const hitArea = this.addElement(
        this.scene.add.rectangle(btnX + spinBtnW / 2, spinBtnY + 14, spinBtnW, 28, 0x000000, 0.001)
          .setOrigin(0.5, 0.5)
          .setInteractive({ useHandCursor: true })
      );

      const dir = opt.dir;
      hitArea.on('pointerdown', () => this.selectSpin(dir));

      this.spinDirs.push(opt.dir);
      this.spinPositions.push({ x: btnX, y: spinBtnY, w: spinBtnW });
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
    for (let i = 0; i < this.spinBgs.length; i++) {
      const bg = this.spinBgs[i];
      const text = this.spinTexts[i];
      const dir = this.spinDirs[i];
      const pos = this.spinPositions[i];

      bg.clear();
      if (dir === this.selectedSpin) {
        bg.fillStyle(0x227722, 1);
        bg.fillRoundedRect(pos.x, pos.y, pos.w, 28, 4);
        text.setColor('#ffffff');
      } else {
        bg.fillStyle(0x333333, 1);
        bg.fillRoundedRect(pos.x, pos.y, pos.w, 28, 4);
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
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
    this.clubButtons = [];
    this.spinBgs = [];
    this.spinTexts = [];
  }
}
