import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertLogbookBaselineDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  prior_flights?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  prior_duration_seconds?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prior_distance_m?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
