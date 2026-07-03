import {
  IsString,
  IsDateString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMediaDto {
  @IsDateString()
  @IsNotEmpty()
  flight_date: string;

  @IsUUID()
  @IsOptional()
  site_id?: string;

  @IsUUID()
  @IsOptional()
  mission_id?: string;

  @Transform(({ value }) => {
    // If it's already an array, return it
    if (Array.isArray(value)) {
      return value;
    }
    // If it's a string, try to parse it as JSON
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        // If JSON parse fails, treat as comma-separated string
        return value.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      }
    }
    // If it's undefined or null, return undefined
    return undefined;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pilots?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
