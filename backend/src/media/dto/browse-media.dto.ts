import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toCsv = ({ value }: { value: unknown }): string[] | undefined => {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string' && value.length > 0) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return undefined;
};

export const MEDIA_SORT_OPTIONS = [
  'newest',
  'oldest',
  'recently_uploaded',
  'highest_rated',
  'longest',
  'shortest',
  'pilot',
  'location',
  'alphabetical',
] as const;

export type MediaSortOption = (typeof MEDIA_SORT_OPTIONS)[number];

export class BrowseMediaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  pageSize?: number = 50;

  @IsString()
  @IsOptional()
  q?: string;

  @Transform(toCsv)
  @IsOptional()
  pilots?: string[];

  @IsUUID()
  @IsOptional()
  site_id?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  year?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @IsString()
  @IsOptional()
  flight_date_from?: string;

  @IsString()
  @IsOptional()
  flight_date_to?: string;

  @IsString()
  @IsOptional()
  uploaded_from?: string;

  @IsString()
  @IsOptional()
  uploaded_to?: string;

  @Transform(toCsv)
  @IsOptional()
  aircraft?: string[];

  @Transform(toCsv)
  @IsOptional()
  wings?: string[];

  @Transform(toCsv)
  @IsOptional()
  engines?: string[];

  @Transform(toCsv)
  @IsOptional()
  tags?: string[];

  @IsIn(['image', 'video'])
  @IsOptional()
  type?: 'image' | 'video';

  @IsBooleanString()
  @IsOptional()
  favorite?: string;

  @IsBooleanString()
  @IsOptional()
  gps_track_available?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  @IsOptional()
  min_rating?: number;

  @IsIn(MEDIA_SORT_OPTIONS)
  @IsOptional()
  sort?: MediaSortOption = 'newest';
}
