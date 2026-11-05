import type { Model, Optional } from 'sequelize';
import type { MediaKind, MediaStatus } from '../../db/models/media.ts';

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
  ownerId: string | null;
}

export type MediaCreationAttributes = Optional<
  MediaAttributes,
  'id' | 'status' | 'originalName' | 'sizeBytes' | 'checksumSha256' | 'width' | 'height' | 'durationMs' | 'variants' | 'ownerId'
>;

export interface MediaInstance extends Model<MediaAttributes, MediaCreationAttributes>, MediaAttributes {}
