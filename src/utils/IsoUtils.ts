import { TILE_WIDTH, TILE_HEIGHT } from './Constants';

export function tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_WIDTH / 2),
    y: (tileX + tileY) * (TILE_HEIGHT / 2),
  };
}
