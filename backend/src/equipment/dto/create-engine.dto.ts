import { IsString, IsNumber, IsOptional, Length, Min, Max } from 'class-validator';

export class CreateEngineDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tank_size_litres?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuel_consumption_lph?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_hours?: number;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
