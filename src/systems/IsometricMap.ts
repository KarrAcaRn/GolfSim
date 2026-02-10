import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from '../utils/Constants';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { CourseData } from '../models/CourseData';
import { tileToWorld } from '../utils/IsoUtils';

export class IsometricMap {
  private scene: Phaser.Scene;
  private width: number;
  private height: number;
  private tiles: TileType[][];
  private tileSprites: (Phaser.GameObjects.Image | null)[][];
  private container: Phaser.GameObjects.Container;
  private gridVisible: boolean = true;
  private blendGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.container = scene.add.container(0, 0);

    // Initialize tile data
    this.tiles = [];
    this.tileSprites = [];
    for (let y = 0; y < height; y++) {
      this.tiles[y] = new Array(width).fill(TileType.GRASS);
      this.tileSprites[y] = new Array(width).fill(null);
    }

    // Blend overlay graphics
    this.blendGraphics = scene.add.graphics();
    this.blendGraphics.setDepth(1); // just above tiles
    this.container.add(this.blendGraphics);

    this.renderAllTiles();
  }

  static generateTileTextures(scene: Phaser.Scene): void {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    for (const [, props] of Object.entries(TILE_PROPERTIES)) {
      for (const suffix of ['', '_clean']) {
        const key = `tile_${props.type}${suffix}`;
        if (scene.textures.exists(key)) continue;

        const graphics = scene.add.graphics();

        // Draw filled diamond
        graphics.fillStyle(props.color, 1);
        graphics.beginPath();
        graphics.moveTo(halfW, 0);
        graphics.lineTo(TILE_WIDTH, halfH);
        graphics.lineTo(halfW, TILE_HEIGHT);
        graphics.lineTo(0, halfH);
        graphics.closePath();
        graphics.fillPath();

        // Grid outline only for non-clean variant
        if (suffix === '') {
          graphics.lineStyle(1, 0x000000, 0.3);
          graphics.beginPath();
          graphics.moveTo(halfW, 0);
          graphics.lineTo(TILE_WIDTH, halfH);
          graphics.lineTo(halfW, TILE_HEIGHT);
          graphics.lineTo(0, halfH);
          graphics.closePath();
          graphics.strokePath();
        }

        graphics.generateTexture(key, TILE_WIDTH, TILE_HEIGHT);
        graphics.destroy();
      }
    }
  }

  private renderAllTiles(): void {
    // Center the map: offset so tile (0,0) renders at a good position
    const offsetX = (this.height * TILE_WIDTH) / 2;
    const offsetY = 50;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const worldPos = tileToWorld(x, y);
        const suffix = this.gridVisible ? '' : '_clean';
        const key = `tile_${this.tiles[y][x]}${suffix}`;
        const sprite = this.scene.add.image(
          worldPos.x + offsetX,
          worldPos.y + offsetY,
          key
        );
        sprite.setOrigin(0.5, 0.5);
        this.container.add(sprite);
        this.tileSprites[y][x] = sprite;
      }
    }

    this.updateBlendOverlays();
  }

  setTileAt(tileX: number, tileY: number, type: TileType): void {
    if (!this.isInBounds(tileX, tileY)) return;
    if (this.tiles[tileY][tileX] === type) return;

    this.tiles[tileY][tileX] = type;

    // Update sprite texture
    const sprite = this.tileSprites[tileY][tileX];
    if (sprite) {
      const suffix = this.gridVisible ? '' : '_clean';
      sprite.setTexture(`tile_${type}${suffix}`);
    }

    this.updateBlendOverlays();
  }

  getTileAt(tileX: number, tileY: number): TileType {
    if (!this.isInBounds(tileX, tileY)) return TileType.GRASS;
    return this.tiles[tileY][tileX];
  }

  isInBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileX < this.width && tileY >= 0 && tileY < this.height;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getTiles(): TileType[][] {
    return this.tiles;
  }

  getOffsetX(): number {
    return (this.height * TILE_WIDTH) / 2;
  }

  getOffsetY(): number {
    return 50;
  }

  /** Convert world coordinates to tile coordinates, accounting for map offset */
  worldToTile(worldX: number, worldY: number): { tileX: number; tileY: number } {
    const adjustedX = worldX - this.getOffsetX();
    const adjustedY = worldY - this.getOffsetY();

    const tileX = Math.floor(adjustedY / TILE_HEIGHT + adjustedX / TILE_WIDTH);
    const tileY = Math.floor(adjustedY / TILE_HEIGHT - adjustedX / TILE_WIDTH);

    return { tileX, tileY };
  }

  /** Convert tile coordinates to world coordinates, accounting for map offset */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    const pos = tileToWorld(tileX, tileY);
    return {
      x: pos.x + this.getOffsetX(),
      y: pos.y + this.getOffsetY(),
    };
  }

  setGridVisible(visible: boolean): void {
    if (this.gridVisible === visible) return;
    this.gridVisible = visible;
    // Update all tile sprites to use correct texture variant
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sprite = this.tileSprites[y][x];
        if (sprite) {
          const suffix = visible ? '' : '_clean';
          sprite.setTexture(`tile_${this.tiles[y][x]}${suffix}`);
        }
      }
    }
    // Rebuild blend overlays
    this.updateBlendOverlays();
  }

  updateBlendOverlays(): void {
    this.blendGraphics.clear();
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tileType = this.tiles[y][x];
        const tileColor = TILE_PROPERTIES[tileType].color;
        const worldPos = tileToWorld(x, y);
        const cx = worldPos.x + offsetX;
        const cy = worldPos.y + offsetY;

        // Check 4 neighbors: N(x,y-1), E(x+1,y), S(x,y+1), W(x-1,y)
        const neighbors = [
          { dx: 0, dy: -1, ox: 0, oy: -TILE_HEIGHT / 4 },   // North
          { dx: 1, dy: 0,  ox: TILE_WIDTH / 4, oy: 0 },      // East
          { dx: 0, dy: 1,  ox: 0, oy: TILE_HEIGHT / 4 },     // South
          { dx: -1, dy: 0, ox: -TILE_WIDTH / 4, oy: 0 },     // West
        ];

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          if (!this.isInBounds(nx, ny)) continue;

          const neighborType = this.tiles[ny][nx];
          if (neighborType === tileType) continue;

          const neighborColor = TILE_PROPERTIES[neighborType].color;
          // Draw a small blended ellipse at the edge toward the neighbor
          this.blendGraphics.fillStyle(neighborColor, 0.2);
          this.blendGraphics.fillEllipse(cx + n.ox, cy + n.oy, 14, 8);
        }
      }
    }
  }

  loadFromData(data: CourseData): void {
    for (let y = 0; y < Math.min(data.height, this.height); y++) {
      for (let x = 0; x < Math.min(data.width, this.width); x++) {
        this.setTileAt(x, y, data.tiles[y][x]);
      }
    }

    this.updateBlendOverlays();
  }

  exportData(): { width: number; height: number; tiles: TileType[][] } {
    // Deep copy tiles
    const tiles = this.tiles.map(row => [...row]);
    return { width: this.width, height: this.height, tiles };
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** Get the world bounds of the entire map for camera clamping */
  getWorldBounds(): { x: number; y: number; width: number; height: number } {
    const topLeft = this.tileToWorld(0, 0);
    const topRight = this.tileToWorld(this.width - 1, 0);
    const bottomLeft = this.tileToWorld(0, this.height - 1);
    const bottomRight = this.tileToWorld(this.width - 1, this.height - 1);

    const minX = Math.min(topLeft.x, bottomLeft.x) - TILE_WIDTH;
    const maxX = Math.max(topRight.x, bottomRight.x) + TILE_WIDTH;
    const minY = Math.min(topLeft.y, topRight.y) - TILE_HEIGHT;
    const maxY = Math.max(bottomLeft.y, bottomRight.y) + TILE_HEIGHT;

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
