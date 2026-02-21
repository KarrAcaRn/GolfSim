import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { TileCoord } from '../models/HoleData';

/** Register a UI element: track it for cleanup, pin to camera, set depth. */
export function addUIElement<T extends Phaser.GameObjects.GameObject>(
  el: T,
  elements: Phaser.GameObjects.GameObject[],
  depth: number,
): T {
  elements.push(el);
  if ('setScrollFactor' in el) (el as any).setScrollFactor(0);
  if ('setDepth' in el) (el as any).setDepth(depth);
  return el;
}

/**
 * Create a marker sprite (flag or tee marker) at a tile position
 * @param scene - Phaser scene
 * @param isoMap - Isometric map for coordinate conversion
 * @param tileCoord - Tile coordinate
 * @param spriteKey - Texture key ('flag', 'tee_marker', or 'cup')
 * @param yOffset - Vertical offset from tile position (default: -12 for flag, -6 for tee_marker)
 * @returns Created sprite
 */
export function createMarkerSprite(
  scene: Phaser.Scene,
  isoMap: IsometricMap,
  tileCoord: TileCoord,
  spriteKey: 'flag' | 'tee_marker' | 'cup',
  yOffset?: number,
): Phaser.GameObjects.Image {
  const worldPos = isoMap.tileToWorld(tileCoord.tileX, tileCoord.tileY);
  const defaultOffsets: Record<string, number> = { flag: -12, tee_marker: -6, cup: 0 };
  const defaultDepths: Record<string, number> = { flag: 500, tee_marker: 500, cup: 499 };
  const sprite = scene.add.image(worldPos.x, worldPos.y + (yOffset ?? defaultOffsets[spriteKey]), spriteKey);
  sprite.setDepth(defaultDepths[spriteKey]).setOrigin(0.5, 0.5);
  return sprite;
}
