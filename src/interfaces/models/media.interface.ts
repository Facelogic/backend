import type { Model, NonAttribute, Optional } from 'sequelize';
import type { MediaKind, MediaStatus } from '../../db/models/media.ts';
import type { SchoolInstance } from './school.interface.ts';
import type { StationInstance } from './station.interface.ts';
import type { UserInstance } from './user.interface.ts';

export interface MediaAttributes {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  bucket: string;
  storageKey: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number | null;
  checksumSha256: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  variants: Record<string, string>;
  ownerId: string;
  schoolId: string;
  stationId: string | null;
  serialCode: string;
}

export type MediaCreationAttributes = Optional<
  MediaAttributes,
  'id' | 'status' | 'originalName' | 'sizeBytes' | 'checksumSha256' | 'width' | 'height' | 'durationMs' | 'variants' | 'stationId' | 'serialCode'
>;

export interface MediaInstance extends Model<MediaAttributes, MediaCreationAttributes>, MediaAttributes {
  readonly createdAt: Date;
  school?: NonAttribute<SchoolInstance>;
  owner?: NonAttribute<UserInstance>;
  station?: NonAttribute<StationInstance | null>;
}
