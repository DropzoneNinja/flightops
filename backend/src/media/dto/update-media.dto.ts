import { IsString, IsDateString, IsArray, IsOptional, IsUUID } from 'class-validator';

export class UpdateMediaDto {
  @IsDateString()
  @IsOptional()
  flight_date?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pilots?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  site_id?: string;

  @IsUUID()
  @IsOptional()
  mission_id?: string;
}
