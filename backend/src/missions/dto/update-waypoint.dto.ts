import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateWaypointDto {
  @IsOptional()
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude?: number;

  @IsOptional()
  @IsNumber()
  altitude?: number | null;

  @IsOptional()
  @IsNumber()
  planned_speed?: number | null;

  @IsOptional()
  @IsNumber()
  leg_minutes?: number | null;
}
