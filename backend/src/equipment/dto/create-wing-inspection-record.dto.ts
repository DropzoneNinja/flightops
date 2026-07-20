import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateWingInspectionRecordDto {
  @IsDateString()
  inspection_date: string;

  @IsString()
  @Length(1, 255)
  inspection_type: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
