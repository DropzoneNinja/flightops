import { IsString, IsNumber, IsOptional, Length, Min } from 'class-validator';

export class CreateReserveDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  model?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  base_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_hours?: number;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
