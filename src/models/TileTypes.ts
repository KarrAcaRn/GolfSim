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
  bounceFactor: number;      // how much vertical velocity is preserved on bounce (0 = no bounce)
  landingSpeedFactor: number; // how much horizontal speed is preserved after final bounce (0 = stop)
}

// friction = damping multiplier per physics step (~60/s).
// Lower value = ball stops faster. Example: 0.90^60 ≈ 0.2% after 1s.
export const TILE_PROPERTIES: Record<TileType, TileProperties> = {
  [TileType.GRASS]:   { type: TileType.GRASS,   friction: 0.88, canPlaceBall: true,  speedMultiplier: 0.8, color: 0x4a8f3f, bounceFactor: 0.55, landingSpeedFactor: 0.25 },
  [TileType.FAIRWAY]: { type: TileType.FAIRWAY,  friction: 0.91, canPlaceBall: true,  speedMultiplier: 1.0, color: 0x5cb85c, bounceFactor: 0.60, landingSpeedFactor: 0.35 },
  [TileType.GREEN]:   { type: TileType.GREEN,    friction: 0.94, canPlaceBall: true,  speedMultiplier: 1.0, color: 0x7dcea0, bounceFactor: 0.65, landingSpeedFactor: 0.40 },
  [TileType.SAND]:    { type: TileType.SAND,     friction: 0.75, canPlaceBall: true,  speedMultiplier: 0.5, color: 0xd4b96a, bounceFactor: 0.0,  landingSpeedFactor: 0.0  },
  [TileType.WATER]:   { type: TileType.WATER,    friction: 0.0,  canPlaceBall: false, speedMultiplier: 0.0, color: 0x3498db, bounceFactor: 0.0,  landingSpeedFactor: 0.0  },
  [TileType.ROUGH]:   { type: TileType.ROUGH,    friction: 0.82, canPlaceBall: true,  speedMultiplier: 0.6, color: 0x3d7a33, bounceFactor: 0.40, landingSpeedFactor: 0.15 },
  [TileType.TEE]:     { type: TileType.TEE,      friction: 0.91, canPlaceBall: true,  speedMultiplier: 1.0, color: 0x8fbc8f, bounceFactor: 0.60, landingSpeedFactor: 0.35 },
};

export const TILE_TYPE_COUNT = Object.keys(TILE_PROPERTIES).length;
