import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    // Load tile textures
    for (let type = 0; type <= 6; type++) {
      this.load.image(`tile_${type}`, `assets/sprites/tiles/tile_${type}.png`);
    }

    // Load sprite assets
    this.load.image('ball', 'assets/sprites/ball.png');
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('flag', 'assets/sprites/flag.png');
    this.load.image('tee_marker', 'assets/sprites/tee_marker.png');
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}
