export interface TileCoord {
  tileX: number;
  tileY: number;
}

export interface HoleData {
  index: number;
  par: number;
  teePosition: TileCoord;
  flagPosition: TileCoord;
}
