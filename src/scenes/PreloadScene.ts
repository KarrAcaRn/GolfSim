import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    // Load tile textures
    for (let type = 0; type <= 6; type++) {
      this.load.image(`tile_${type}`, `assets/sprites/tiles/tile_${type}.png`);
      this.load.image(`tile_${type}_clean`, `assets/sprites/tiles/tile_${type}_clean.png`);
    }
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}
