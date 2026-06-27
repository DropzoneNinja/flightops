import { IsString, IsOptional, IsUUID, IsNumber, Length, Min } from 'class-validator';

export class CreateParamotorDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsUUID()
  engine_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_hours?: number;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
