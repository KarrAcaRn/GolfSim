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
 * @param spriteKey - Texture key ('flag' or 'tee_marker')
 * @param yOffset - Vertical offset from tile position (default: -12 for flag, -6 for tee_marker)
 * @returns Created sprite
 */
export function createMarkerSprite(
  scene: Phaser.Scene,
  isoMap: IsometricMap,
  tileCoord: TileCoord,
  spriteKey: 'flag' | 'tee_marker',
  yOffset?: number,
): Phaser.GameObjects.Image {
  const worldPos = isoMap.tileToWorld(tileCoord.tileX, tileCoord.tileY);
  const defaultOffset = spriteKey === 'flag' ? -12 : -6;
  const sprite = scene.add.image(worldPos.x, worldPos.y + (yOffset ?? defaultOffset), spriteKey);
  sprite.setDepth(500).setOrigin(0.5, 1);
  return sprite;
}
