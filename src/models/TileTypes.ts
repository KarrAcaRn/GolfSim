export enum TileType {
  GRASS = 0,
  FAIRWAY = 1,
  GREEN = 2,
  SAND = 3,
  WATER = 4,
  ROUGH = 5,
  TEE = 6,
}

export interface TileProperties {
  type: TileType;
  friction: number;
  canPlaceBall: boolean;
  speedMultiplier: number;
  color: number; // for placeholder rendering
}

// friction = damping multiplier per physics step (~60/s).
// Lower value = ball stops faster. 0.95 at 60fps → ~5% speed after 1s.
export const TILE_PROPERTIES: Record<TileType, TileProperties> = {
  [TileType.GRASS]:   { type: TileType.GRASS,   friction: 0.93, canPlaceBall: true,  speedMultiplier: 0.8, color: 0x4a8f3f },
  [TileType.FAIRWAY]: { type: TileType.FAIRWAY,  friction: 0.95, canPlaceBall: true,  speedMultiplier: 1.0, color: 0x5cb85c },
  [TileType.GREEN]:   { type: TileType.GREEN,    friction: 0.97, canPlaceBall: true,  speedMultiplier: 1.0, color: 0x7dcea0 },
  [TileType.SAND]:    { type: TileType.SAND,     friction: 0.82, canPlaceBall: true,  speedMultiplier: 0.5, color: 0xd4b96a },
  [TileType.WATER]:   { type: TileType.WATER,    friction: 0.0,  canPlaceBall: false, speedMultiplier: 0.0, color: 0x3498db },
  [TileType.ROUGH]:   { type: TileType.ROUGH,    friction: 0.88, canPlaceBall: true,  speedMultiplier: 0.6, color: 0x3d7a33 },
  [TileType.TEE]:     { type: TileType.TEE,      friction: 0.95, canPlaceBall: true,  speedMultiplier: 1.0, color: 0x8fbc8f },
};

export const TILE_TYPE_COUNT = Object.keys(TILE_PROPERTIES).length;
