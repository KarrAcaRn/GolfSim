export interface Club {
  id: string;
  nameKey: string;   // i18n key, e.g. 'clubs.driver'
  minPower: number;
  maxPower: number;
  loftDegrees: number;
  teeOnly: boolean;  // true = can only be used on TEE tiles
}

export const CLUBS: Club[] = [
  { id: 'driver',     nameKey: 'clubs.driver',     minPower: 200, maxPower: 600, loftDegrees: 12, teeOnly: true },
  { id: 'wood',       nameKey: 'clubs.wood',       minPower: 150, maxPower: 500, loftDegrees: 20, teeOnly: false },
  { id: 'iron',       nameKey: 'clubs.iron',       minPower: 80,  maxPower: 400, loftDegrees: 35, teeOnly: false },
  { id: 'sandwedge',  nameKey: 'clubs.sandWedge',  minPower: 40,  maxPower: 300, loftDegrees: 55, teeOnly: false },
  { id: 'putter',     nameKey: 'clubs.putter',     minPower: 10,  maxPower: 200, loftDegrees: 0,  teeOnly: false },
];

export const DEFAULT_CLUB_INDEX = 2; // Iron
