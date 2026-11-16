// "Station"."status" is a SMALLINT (see migration 20261111000001-add-status-to-station).
export const StationStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
} as const;

export type StationStatus = (typeof StationStatus)[keyof typeof StationStatus];
