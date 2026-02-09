import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    // Future: load sprite sheets, audio, etc.
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}
