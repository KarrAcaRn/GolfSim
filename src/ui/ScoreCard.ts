import Phaser from 'phaser';
import { HoleData } from '../models/HoleData';
import { t } from '../i18n/i18n';
import { getScoreColor, getScoreText } from '../utils/ScoreUtils';

interface PlayerRow {
  name: string;
  strokes: number[];
  tint?: number;
}

/**
 * Horizontal scorecard table:
 *   | Hole   | 1 | 2 | 3 | ... | Total |
 *   | Par    | 3 | 4 | 5 | ... |  36   |
 *   | Player | 4 | 3 | 6 | ... |  38   |
 *   | Guest  | 3 | 5 | 4 | ... |  35   |
 *
 * Uses individual elements with setScrollFactor(0) — NO Container.
 */
export class ScoreCard {
  private elements: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    holes: HoleData[],
    players: PlayerRow[],
  ) {
    const holeCount = holes.length;
    const colW = 36;
    const labelW = 70;
    const totalColW = 50;
    const rowH = 24;
    const headerH = 28;
    const padding = 16;

    const tableW = labelW + holeCount * colW + totalColW;
    const rowCount = 2 + players.length; // header + par + players
    const tableH = headerH + rowCount * rowH;
    const cardW = tableW + padding * 2;
    const cardH = tableH + padding * 2 + 50; // extra space for title + continue text

    const { width, height } = scene.scale;
    const originX = (width - cardW) / 2;
    const originY = (height - cardH) / 2;

    const depth = 3000;

    // Dimmed background overlay
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(depth - 1);
    this.elements.push(overlay);

    // Card background
    const bg = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(originX, originY, cardW, cardH, 10);
    bg.lineStyle(2, 0x888888, 0.8);
    bg.strokeRoundedRect(originX, originY, cardW, cardH, 10);
    this.elements.push(bg);

    // Title
    const title = scene.add.text(width / 2, originY + 18, t('play.courseComplete'), {
      fontSize: '20px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth);
    this.elements.push(title);

    const tableX = originX + padding;
    const tableY = originY + 50;

    // --- Header row: Hole | 1 | 2 | ... | Total ---
    this.addCell(scene, tableX, tableY, labelW, headerH, 'Hole', '#888888', 'bold', depth);
    for (let i = 0; i < holeCount; i++) {
      this.addCell(scene, tableX + labelW + i * colW, tableY, colW, headerH, `${i + 1}`, '#bbbbbb', 'bold', depth);
    }
    this.addCell(scene, tableX + labelW + holeCount * colW, tableY, totalColW, headerH, 'Total', '#888888', 'bold', depth);

    // Separator line under header
    const sepY = tableY + headerH;
    const sepLine = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    sepLine.lineStyle(1, 0x555555);
    sepLine.lineBetween(tableX, sepY, tableX + tableW, sepY);
    this.elements.push(sepLine);

    // --- Par row ---
    const parY = tableY + headerH;
    const totalPar = holes.reduce((s, h) => s + h.par, 0);
    this.addCell(scene, tableX, parY, labelW, rowH, 'Par', '#888888', 'normal', depth);
    for (let i = 0; i < holeCount; i++) {
      this.addCell(scene, tableX + labelW + i * colW, parY, colW, rowH, `${holes[i].par}`, '#aaaaaa', 'normal', depth);
    }
    this.addCell(scene, tableX + labelW + holeCount * colW, parY, totalColW, rowH, `${totalPar}`, '#aaaaaa', 'bold', depth);

    // --- Player rows ---
    for (let p = 0; p < players.length; p++) {
      const player = players[p];
      const rowY = parY + rowH + p * rowH;

      // Separator line between par and first player
      if (p === 0) {
        const sep2 = scene.add.graphics().setScrollFactor(0).setDepth(depth);
        sep2.lineStyle(1, 0x444444);
        sep2.lineBetween(tableX, rowY, tableX + tableW, rowY);
        this.elements.push(sep2);
      }

      // Player name with tint-colored indicator
      const nameColor = player.tint
        ? `#${player.tint.toString(16).padStart(6, '0')}`
        : '#ffffff';
      this.addCell(scene, tableX, rowY, labelW, rowH, player.name, nameColor, 'bold', depth);

      // Strokes per hole
      let playerTotal = 0;
      for (let i = 0; i < holeCount; i++) {
        const strokes = player.strokes[i] ?? 0;
        playerTotal += strokes;
        const diff = strokes - holes[i].par;
        const colorHex = getScoreColor(diff);
        const color = `#${colorHex.toString(16).padStart(6, '0')}`;
        this.addCell(scene, tableX + labelW + i * colW, rowY, colW, rowH, strokes > 0 ? `${strokes}` : '-', color, 'normal', depth);
      }

      // Total
      const totalDiff = playerTotal - totalPar;
      const totalColorHex = getScoreColor(totalDiff);
      const totalColor = `#${totalColorHex.toString(16).padStart(6, '0')}`;
      const totalText = `${playerTotal} (${getScoreText(totalDiff)})`;
      this.addCell(scene, tableX + labelW + holeCount * colW, rowY, totalColW, rowH, totalText, totalColor, 'bold', depth);
    }

    // "Click to continue" text
    const continueText = scene.add.text(width / 2, originY + cardH - 18, t('play.clickToContinue'), {
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth);
    this.elements.push(continueText);
  }

  private addCell(
    scene: Phaser.Scene,
    x: number, y: number,
    w: number, h: number,
    text: string,
    color: string,
    style: 'normal' | 'bold',
    depth: number,
  ): void {
    const t = scene.add.text(x + w / 2, y + h / 2, text, {
      fontSize: '11px',
      color,
      fontStyle: style,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);
    this.elements.push(t);
  }

  getElements(): Phaser.GameObjects.GameObject[] {
    return this.elements;
  }

  destroy(): void {
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
  }
}
