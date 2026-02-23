import { IsDateString, IsOptional } from 'class-validator';

export class QueryMediaDto {
  @IsDateString()
  @IsOptional()
  date?: string;
}
