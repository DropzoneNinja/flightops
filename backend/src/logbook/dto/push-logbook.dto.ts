import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PushEntryDto {
  @IsUUID()
  client_id: string;

  @IsDateString()
  client_updated_at: string;

  @IsDateString()
  flight_date: string;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distance_m?: number;

  @IsOptional()
  @IsNumber()
  avg_speed_mps?: number;

  @IsOptional()
  @IsNumber()
  max_speed_mps?: number;

  @IsOptional()
  @IsNumber()
  max_altitude_m?: number;

  @IsOptional()
  @IsNumber()
  avg_altitude_m?: number;

  @IsOptional()
  @IsNumber()
  max_climb_mps?: number;

  @IsOptional()
  @IsNumber()
  max_sink_mps?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  takeoff_lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  takeoff_lon?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  landing_lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  landing_lon?: number;

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
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
  equipment_refs_json?: { paramotorId?: string; engineId?: string; wingId?: string };

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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

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

  /** If present and truthy, treat this push as a soft-delete. */
  @IsOptional()
  @IsDateString()
  deleted_at?: string;
}

export class DeleteRefDto {
  @IsUUID()
  client_id: string;

  @IsDateString()
  deleted_at: string;
}

export class PushLogbookDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushEntryDto)
  entries: PushEntryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeleteRefDto)
  deletes: DeleteRefDto[];
}
