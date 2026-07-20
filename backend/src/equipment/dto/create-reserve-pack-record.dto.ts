import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateReservePackRecordDto {
  @IsDateString()
  pack_date: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
