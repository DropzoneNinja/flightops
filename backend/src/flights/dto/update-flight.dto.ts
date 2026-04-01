import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class UpdateFlightDto {
  @IsOptional()
  @IsUUID()
  pilot_id?: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

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
  glider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  harness?: string;
}
