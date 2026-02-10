export interface PlayerHitParams {
  /** Min speed deviation as fraction, e.g. -0.10 = -10% */
  hitSpeedDifferenceMin: number;
  /** Max speed deviation as fraction, e.g. 0.01 = +1% */
  hitSpeedDifferenceMax: number;
  /** Max direction deviation in degrees, applied as ±value */
  hitAccuracy: number;
}

export const DEFAULT_HIT_PARAMS: PlayerHitParams = {
  hitSpeedDifferenceMin: -0.10,
  hitSpeedDifferenceMax: 0.01,
  hitAccuracy: 2.0,
};
