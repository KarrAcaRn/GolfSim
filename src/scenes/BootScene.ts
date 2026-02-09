import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    // Generate placeholder tile textures programmatically
    IsometricMap.generateTileTextures(this);
    this.scene.start('Preload');
  }
}
