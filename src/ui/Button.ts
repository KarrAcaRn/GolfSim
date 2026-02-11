import Phaser from 'phaser';

export interface ButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: string;
  bgColor?: number;
  hoverColor?: number;
  textColor?: string;
  onClick: () => void;
}

export class Button {
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private config: ButtonConfig;
  private isActive = false;

  constructor(scene: Phaser.Scene, config: ButtonConfig) {
    this.config = config;
    const bgColor = config.bgColor ?? 0x444444;
    const hoverColor = config.hoverColor ?? 0x666666;

    this.bg = scene.add.rectangle(config.x, config.y, config.width, config.height, bgColor)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);

    this.label = scene.add.text(
      config.x + config.width / 2,
      config.y + config.height / 2,
      config.text,
      {
        fontSize: config.fontSize ?? '12px',
        color: config.textColor ?? '#ffffff',
        align: 'center',
      }
    ).setOrigin(0.5).setScrollFactor(0);

    this.bg.on('pointerover', () => {
      if (!this.isActive) this.bg.setFillStyle(hoverColor);
    });

    this.bg.on('pointerout', () => {
      if (!this.isActive) this.bg.setFillStyle(bgColor);
    });

    this.bg.on('pointerdown', () => {
      config.onClick();
    });
  }

  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.bg.setFillStyle(0x88aa44);
    } else {
      this.bg.setFillStyle(this.config.bgColor ?? 0x444444);
    }
  }

  setText(text: string): void {
    this.label.setText(text);
  }

  setDepth(depth: number): void {
    this.bg.setDepth(depth);
    this.label.setDepth(depth + 1);
  }

  setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.label.setVisible(visible);
    if (visible) {
      this.bg.setInteractive();
    } else {
      this.bg.disableInteractive();
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }
}
