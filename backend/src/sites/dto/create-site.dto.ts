import { IsString, IsNumber, Min, Max, Length, IsOptional } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @Length(1, 255, { message: 'Site name must be between 1 and 255 characters' })
  name: string;

  @IsNumber()
  @Min(-90, { message: 'Takeoff latitude must be between -90 and 90' })
  @Max(90, { message: 'Takeoff latitude must be between -90 and 90' })
  takeoff_lat: number;

  @IsNumber()
  @Min(-180, { message: 'Takeoff longitude must be between -180 and 180' })
  @Max(180, { message: 'Takeoff longitude must be between -180 and 180' })
  takeoff_lon: number;

  @IsNumber()
  @Min(-90, { message: 'Parking latitude must be between -90 and 90' })
  @Max(90, { message: 'Parking latitude must be between -90 and 90' })
  parking_lat: number;

  @IsNumber()
  @Min(-180, { message: 'Parking longitude must be between -180 and 180' })
  @Max(180, { message: 'Parking longitude must be between -180 and 180' })
  parking_lon: number;

  @IsOptional()
  @IsString()
  @Length(0, 10000, { message: 'Takeoff notes must not exceed 10000 characters' })
  takeoff_notes?: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000, { message: 'Parking notes must not exceed 10000 characters' })
  parking_notes?: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000, { message: 'Weather notes must not exceed 10000 characters' })
  weather_notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(-500)
  @Max(9000)
  elevation_m?: number;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Country must not exceed 100 characters' })
  country?: string;

}
