import { TileType } from './TileTypes';

export interface ClubTerrainModifier {
  hitSpeedDifferenceMin: number;
  hitSpeedDifferenceMax: number;
  hitAccuracy: number;
  spinAngle?: number;
}

export interface Club {
  id: string;
  nameKey: string;   // i18n key, e.g. 'clubs.driver'
  minPower: number;
  maxPower: number;
  loftDegrees: number;
  spinAngle: number;  // base spin angle in degrees
  teeOnly: boolean;  // true = can only be used on TEE tiles
  terrainModifiers: Partial<Record<TileType, ClubTerrainModifier>>;
}

export const CLUBS: Club[] = [
  {
    id: 'driver',
    nameKey: 'clubs.driver',
    minPower: 200,
    maxPower: 600,
    loftDegrees: 12,
    spinAngle: 10,
    teeOnly: true,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.30, hitSpeedDifferenceMax: -0.10, hitAccuracy: 5.0, spinAngle: -6 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.15, hitSpeedDifferenceMax: -0.05, hitAccuracy: 2.0, spinAngle: -3 },
    }
  },
  {
    id: 'wood',
    nameKey: 'clubs.wood',
    minPower: 150,
    maxPower: 500,
    loftDegrees: 20,
    spinAngle: 15,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.25, hitSpeedDifferenceMax: -0.08, hitAccuracy: 4.0, spinAngle: -8 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.10, hitSpeedDifferenceMax: -0.03, hitAccuracy: 1.5, spinAngle: -4 },
    }
  },
  {
    id: 'iron',
    nameKey: 'clubs.iron',
    minPower: 80,
    maxPower: 400,
    loftDegrees: 35,
    spinAngle: 20,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.15, hitSpeedDifferenceMax: -0.05, hitAccuracy: 2.0, spinAngle: -6 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.05, hitSpeedDifferenceMax: -0.01, hitAccuracy: 0.5, spinAngle: -2 },
    }
  },
  {
    id: 'sandwedge',
    nameKey: 'clubs.sandWedge',
    minPower: 40,
    maxPower: 300,
    loftDegrees: 55,
    spinAngle: 25,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.02, hitSpeedDifferenceMax: 0.00, hitAccuracy: 0.5, spinAngle: 5 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.05, hitSpeedDifferenceMax: -0.01, hitAccuracy: 0.5, spinAngle: -2 },
    }
  },
  {
    id: 'putter',
    nameKey: 'clubs.putter',
    minPower: 10,
    maxPower: 200,
    loftDegrees: 0,
    spinAngle: 8,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.20, hitSpeedDifferenceMax: -0.10, hitAccuracy: 3.0, spinAngle: -4 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.10, hitSpeedDifferenceMax: -0.05, hitAccuracy: 1.5, spinAngle: -3 },
    }
  },
];

export const DEFAULT_CLUB_INDEX = 2; // Iron
export const SPIN_DECAY = 0.4;
