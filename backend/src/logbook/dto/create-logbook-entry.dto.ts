import {
  IsDateString,
  IsOptional,
  IsUUID,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateLogbookEntryDto {
  @IsDateString()
  flight_date: string;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;

  /** Pass a client-generated UUID for idempotent retry (web creates). */
  @IsOptional()
  @IsUUID()
  client_id?: string;

  /** Link an existing flight record (sets the GPX track). Only honoured on update; ignored on create. */
  @IsOptional()
  @IsUUID()
  flight_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  launch_site_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  landing_site_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  /** Selected mission, when category is "Mission". */
  @IsOptional()
  @IsUUID()
  mission_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  flight_purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  route_name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  wing?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  engine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  paramotor?: string;

  @IsOptional()
  @IsUUID()
  wing_id?: string;

  @IsOptional()
  @IsUUID()
  paramotor_id?: string;

  @IsOptional()
  @IsNumber()
  fuel_start_litres?: number;

  @IsOptional()
  @IsNumber()
  fuel_used_litres?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  battery_start_percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  battery_used_percent?: number;

  /** Manual flight duration in seconds. Overridden by GPX analysis for display. */
  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  /** Manual max altitude in metres. Overridden by GPX analysis for display. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_altitude_m?: number;

  /** Manual max speed in m/s. Overridden by GPX analysis for display. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_speed_mps?: number;

  /** Manual total distance in metres. Overridden by GPX analysis for display. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  distance_m?: number;
}
