import {
  IsString,
  IsDateString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

const toStringArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    }
  }
  return undefined;
};

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

  @IsUUID()
  @IsOptional()
  flight_id?: string;

  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pilots?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  aircraft?: string;

  @IsString()
  @IsOptional()
  wing?: string;

  @IsString()
  @IsOptional()
  engine?: string;
}
