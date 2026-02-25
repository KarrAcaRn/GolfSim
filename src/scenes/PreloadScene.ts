import Phaser from 'phaser';
import { TILE_NAMES, TileType } from '../models/TileTypes';
import { generateBlendMasks } from '../systems/BlendMasks';

const VARIANTS_PER_TILE = 5;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    // Load tile textures (5 variants per type)
    for (const type of Object.values(TileType).filter((v): v is TileType => typeof v === 'number')) {
      const name = TILE_NAMES[type];
      for (let v = 0; v < VARIANTS_PER_TILE; v++) {
        this.load.image(`tile_${name}_${v}`, `assets/sprites/tiles/tile_${name}_${v}.png`);
      }
    }

    // Load sprite assets
    this.load.image('ball', 'assets/sprites/ball.png');
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('flag', 'assets/sprites/flag.png');
    this.load.image('tee_marker', 'assets/sprites/tee_marker.png');
    this.load.image('cup', 'assets/sprites/cup.png');
    this.load.image('ball_shadow', 'assets/sprites/ball_shadow.png');
  }

  create(): void {
    generateBlendMasks(this);
    this.scene.start('MainMenu');
  }
}
