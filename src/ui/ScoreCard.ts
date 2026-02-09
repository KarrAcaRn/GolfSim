import Phaser from 'phaser';
import { HoleData } from '../models/HoleData';
import { t } from '../i18n/i18n';

export class ScoreCard {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    holes: HoleData[],
    strokes: number[]
  ) {
    const { width, height } = scene.scale;
    this.container = scene.add.container(width / 2, height / 2);
    this.container.setDepth(3000);
    this.container.setScrollFactor(0);

    const cardWidth = 400;
    const rowHeight = 24;
    const cardHeight = 80 + holes.length * rowHeight + 40;

    // Background
    this.bg = scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x222222, 0.95);
    this.bg.setStrokeStyle(2, 0x888888);
    this.container.add(this.bg);

    // Title
    const titleText = scene.add.text(0, -cardHeight / 2 + 20, t('play.courseComplete'), {
      fontSize: '22px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(titleText);

    // Headers
    let y = -cardHeight / 2 + 55;
    const headerText = scene.add.text(-140, y, 'Hole', { fontSize: '12px', color: '#888888' });
    const parHeader = scene.add.text(0, y, 'Par', { fontSize: '12px', color: '#888888' }).setOrigin(0.5, 0);
    const strokeHeader = scene.add.text(80, y, 'Strokes', { fontSize: '12px', color: '#888888' }).setOrigin(0.5, 0);
    const scoreHeader = scene.add.text(150, y, 'Score', { fontSize: '12px', color: '#888888' }).setOrigin(0.5, 0);
    this.container.add([headerText, parHeader, strokeHeader, scoreHeader]);

    y += rowHeight;

    // Hole rows
    let totalStrokes = 0;
    let totalPar = 0;

    for (let i = 0; i < holes.length; i++) {
      const hole = holes[i];
      const holeStrokes = strokes[i] || 0;
      const diff = holeStrokes - hole.par;
      totalStrokes += holeStrokes;
      totalPar += hole.par;

      const color = diff < 0 ? '#4caf50' : diff > 0 ? '#f44336' : '#ffffff';

      const holeNum = scene.add.text(-140, y, `${i + 1}`, { fontSize: '12px', color: '#ffffff' });
      const parText = scene.add.text(0, y, `${hole.par}`, { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0.5, 0);
      const strokeText = scene.add.text(80, y, `${holeStrokes}`, { fontSize: '12px', color });
      strokeText.setOrigin(0.5, 0);
      const scoreText = scene.add.text(150, y, diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`), {
        fontSize: '12px',
        color,
      }).setOrigin(0.5, 0);

      this.container.add([holeNum, parText, strokeText, scoreText]);
      y += rowHeight;
    }

    // Total row
    y += 8;
    const totalDiff = totalStrokes - totalPar;
    const totalColor = totalDiff < 0 ? '#4caf50' : totalDiff > 0 ? '#f44336' : '#ffffff';

    const totalLabel = scene.add.text(-140, y, 'Total', { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' });
    const totalParText = scene.add.text(0, y, `${totalPar}`, { fontSize: '14px', color: '#aaaaaa', fontStyle: 'bold' }).setOrigin(0.5, 0);
    const totalStrokeText = scene.add.text(80, y, `${totalStrokes}`, { fontSize: '14px', color: totalColor, fontStyle: 'bold' }).setOrigin(0.5, 0);
    const totalScoreText = scene.add.text(150, y, totalDiff === 0 ? 'E' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`), {
      fontSize: '14px',
      color: totalColor,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.container.add([totalLabel, totalParText, totalStrokeText, totalScoreText]);
  }

  destroy(): void {
    this.container.destroy();
  }
}
