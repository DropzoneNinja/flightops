import { IsString, IsOptional, IsUUID, IsNumber, Length } from 'class-validator';

export class CreateMissionDto {
  @IsString()
  @Length(1, 120, { message: 'Mission name must be between 1 and 120 characters' })
  name: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  launch_site_id?: string | null;

  @IsOptional()
  @IsNumber()
  avg_fuel_consumption?: number | null;

  @IsOptional()
  @IsNumber()
  fuel_tank_size?: number | null;

  @IsOptional()
  @IsNumber()
  wind_direction?: number | null;

  @IsOptional()
  @IsNumber()
  wind_speed?: number | null;
}
