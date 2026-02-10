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
        const rand = IsometricMap.seededRandom(props.type * 1000 + (suffix === '_clean' ? 500 : 0));

        // 1. Draw filled diamond base
        graphics.fillStyle(props.color, 1);
        graphics.beginPath();
        graphics.moveTo(halfW, 0);
        graphics.lineTo(TILE_WIDTH, halfH);
        graphics.lineTo(halfW, TILE_HEIGHT);
        graphics.lineTo(0, halfH);
        graphics.closePath();
        graphics.fillPath();

        // 2. Draw pattern based on type
        switch (props.type) {
          case TileType.GRASS:
            IsometricMap.drawGrassPattern(graphics, halfW, halfH, props.color, rand);
            break;
          case TileType.FAIRWAY:
            IsometricMap.drawFairwayPattern(graphics, halfW, halfH, props.color, rand);
            break;
          case TileType.GREEN:
            IsometricMap.drawGreenPattern(graphics, halfW, halfH, props.color, rand);
            break;
          case TileType.SAND:
            IsometricMap.drawSandPattern(graphics, halfW, halfH, props.color, rand);
            break;
          case TileType.WATER:
            IsometricMap.drawWaterPattern(graphics, halfW, halfH, props.color, rand);
            break;
          case TileType.ROUGH:
            IsometricMap.drawRoughPattern(graphics, halfW, halfH, props.color, rand);
            break;
          case TileType.TEE:
            IsometricMap.drawTeePattern(graphics, halfW, halfH, props.color, rand);
            break;
        }

        // 3. Grid outline only for non-clean variant
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

  // === Helper Methods for Texture Generation ===

  private static seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private static adjustColor(color: number, amount: number): number {
    const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
    return (r << 16) | (g << 8) | b;
  }

  private static isInsideDiamond(px: number, py: number, halfW: number, halfH: number): boolean {
    return Math.abs(px - halfW) / halfW + Math.abs(py - halfH) / halfH <= 1;
  }

  private static getDiamondWidthAtY(y: number, halfW: number, halfH: number): { minX: number; maxX: number } {
    const dy = Math.abs(y - halfH) / halfH;
    const extent = halfW * (1 - dy);
    return { minX: halfW - extent, maxX: halfW + extent };
  }

  // === Pattern Drawing Methods ===

  private static drawGrassPattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // Draw ~20 small grass tufts with 2-3 short lines each
    for (let i = 0; i < 20; i++) {
      const px = rand() * TILE_WIDTH;
      const py = rand() * TILE_HEIGHT;

      if (!IsometricMap.isInsideDiamond(px, py, halfW, halfH)) continue;

      const colorVariation = rand() < 0.5 ? -20 : 15;
      const tuftColor = IsometricMap.adjustColor(baseColor, colorVariation);
      const lineCount = Math.floor(rand() * 2) + 2; // 2-3 lines

      graphics.lineStyle(1, tuftColor, 0.8);
      for (let j = 0; j < lineCount; j++) {
        const angle = rand() * Math.PI * 2;
        const length = rand() * 2 + 2; // 2-4px
        const x1 = px;
        const y1 = py;
        const x2 = x1 + Math.cos(angle) * length;
        const y2 = y1 + Math.sin(angle) * length;
        graphics.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  private static drawFairwayPattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // Draw alternating horizontal mow stripes
    const stripeHeight = 3;
    const lighterColor = IsometricMap.adjustColor(baseColor, 12);

    for (let y = 0; y < TILE_HEIGHT; y += stripeHeight * 2) {
      const { minX, maxX } = IsometricMap.getDiamondWidthAtY(y + stripeHeight / 2, halfW, halfH);
      if (maxX > minX) {
        graphics.fillStyle(lighterColor, 0.5);
        graphics.fillRect(minX, y, maxX - minX, stripeHeight);
      }
    }
  }

  private static drawGreenPattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // Draw fine horizontal lines every 2-3px
    const lighterColor = IsometricMap.adjustColor(baseColor, 8);
    graphics.lineStyle(1, lighterColor, 0.3);

    for (let y = 2; y < TILE_HEIGHT; y += 3) {
      const { minX, maxX } = IsometricMap.getDiamondWidthAtY(y, halfW, halfH);
      if (maxX > minX) {
        graphics.lineBetween(minX, y, maxX, y);
      }
    }

    // Add 3-5 tiny highlight dots
    const dotCount = Math.floor(rand() * 3) + 3;
    graphics.fillStyle(IsometricMap.adjustColor(baseColor, 15), 0.6);
    for (let i = 0; i < dotCount; i++) {
      const px = rand() * TILE_WIDTH;
      const py = rand() * TILE_HEIGHT;
      if (IsometricMap.isInsideDiamond(px, py, halfW, halfH)) {
        graphics.fillRect(px, py, 1, 1);
      }
    }
  }

  private static drawSandPattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // Draw ~30 random small dots (sand grains)
    for (let i = 0; i < 30; i++) {
      const px = rand() * TILE_WIDTH;
      const py = rand() * TILE_HEIGHT;

      if (!IsometricMap.isInsideDiamond(px, py, halfW, halfH)) continue;

      const colorVariation = rand() < 0.5 ? 20 : -15;
      const dotColor = IsometricMap.adjustColor(baseColor, colorVariation);
      graphics.fillStyle(dotColor, 0.5);
      graphics.fillRect(px, py, 1, 1);
    }

    // Draw 2-3 gentle wave lines
    const waveColor = IsometricMap.adjustColor(baseColor, -10);
    graphics.lineStyle(1, waveColor, 0.3);

    const waveCount = Math.floor(rand() * 2) + 2;
    for (let i = 0; i < waveCount; i++) {
      const yStart = rand() * TILE_HEIGHT;
      const amplitude = 2;
      const frequency = 0.3;

      graphics.beginPath();
      let firstPoint = true;
      for (let x = 0; x < TILE_WIDTH; x++) {
        const y = yStart + Math.sin(x * frequency) * amplitude;
        if (IsometricMap.isInsideDiamond(x, y, halfW, halfH)) {
          if (firstPoint) {
            graphics.moveTo(x, y);
            firstPoint = false;
          } else {
            graphics.lineTo(x, y);
          }
        }
      }
      graphics.strokePath();
    }
  }

  private static drawWaterPattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // Draw 3-4 wavy horizontal lines
    const waveColor = IsometricMap.adjustColor(baseColor, 30);
    graphics.lineStyle(1, waveColor, 0.4);

    const waveCount = Math.floor(rand() * 2) + 3;
    for (let i = 0; i < waveCount; i++) {
      const yBase = (TILE_HEIGHT / (waveCount + 1)) * (i + 1);
      const amplitude = 2;
      const frequency = 0.4;
      const phase = rand() * Math.PI * 2;

      graphics.beginPath();
      let firstPoint = true;
      for (let step = 0; step <= 32; step++) {
        const x = (step / 32) * TILE_WIDTH;
        const y = yBase + Math.sin(x * frequency + phase) * amplitude;
        const { minX, maxX } = IsometricMap.getDiamondWidthAtY(y, halfW, halfH);

        if (x >= minX && x <= maxX) {
          if (firstPoint) {
            graphics.moveTo(x, y);
            firstPoint = false;
          } else {
            graphics.lineTo(x, y);
          }
        }
      }
      graphics.strokePath();
    }

    // Add 4-6 tiny white highlight dots
    const dotCount = Math.floor(rand() * 3) + 4;
    graphics.fillStyle(0xffffff, 0.4);
    for (let i = 0; i < dotCount; i++) {
      const px = rand() * TILE_WIDTH;
      const py = rand() * TILE_HEIGHT;
      if (IsometricMap.isInsideDiamond(px, py, halfW, halfH)) {
        graphics.fillRect(px, py, 1, 1);
      }
    }
  }

  private static drawRoughPattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // Draw ~35 dense grass tufts with longer lines
    for (let i = 0; i < 35; i++) {
      const px = rand() * TILE_WIDTH;
      const py = rand() * TILE_HEIGHT;

      if (!IsometricMap.isInsideDiamond(px, py, halfW, halfH)) continue;

      const colorVariation = -Math.floor(rand() * 16 + 10); // -10 to -25
      const tuftColor = IsometricMap.adjustColor(baseColor, colorVariation);
      const lineCount = Math.floor(rand() * 2) + 2; // 2-3 lines

      graphics.lineStyle(1, tuftColor, 0.8);
      for (let j = 0; j < lineCount; j++) {
        const angle = rand() * Math.PI * 2;
        const length = rand() * 2 + 3; // 3-5px
        const x1 = px;
        const y1 = py;
        const x2 = x1 + Math.cos(angle) * length;
        const y2 = y1 + Math.sin(angle) * length;
        graphics.lineBetween(x1, y1, x2, y2);
      }
    }

    // Add ~8 dark patches
    const patchCount = Math.floor(rand() * 3) + 6;
    const patchColor = IsometricMap.adjustColor(baseColor, -20);
    for (let i = 0; i < patchCount; i++) {
      const px = rand() * TILE_WIDTH;
      const py = rand() * TILE_HEIGHT;
      if (IsometricMap.isInsideDiamond(px, py, halfW, halfH)) {
        const radius = rand() * 1 + 1; // 1-2px
        graphics.fillStyle(patchColor, 0.3);
        graphics.fillCircle(px, py, radius);
      }
    }
  }

  private static drawTeePattern(
    graphics: Phaser.GameObjects.Graphics,
    halfW: number,
    halfH: number,
    baseColor: number,
    rand: () => number
  ): void {
    // First draw fairway-style mow stripes
    IsometricMap.drawFairwayPattern(graphics, halfW, halfH, baseColor, rand);

    // Add a tee marker in the center
    const markerColor = IsometricMap.adjustColor(baseColor, 25);
    graphics.fillStyle(markerColor, 0.8);
    graphics.fillCircle(halfW, halfH, 3);

    // Add small cross lines
    graphics.lineStyle(1, markerColor, 0.8);
    graphics.lineBetween(halfW - 4, halfH, halfW + 4, halfH);
    graphics.lineBetween(halfW, halfH - 4, halfW, halfH + 4);
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
