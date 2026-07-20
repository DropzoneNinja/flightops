import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateEngineServiceRecordDto {
  @IsDateString()
  service_date: string;

  @IsString()
  @Length(1, 255)
  service_type: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
