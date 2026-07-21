import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateReserveDto } from './create-reserve.dto';

export class UpdateReserveDto extends PartialType(CreateReserveDto) {
  // Optional optimistic-concurrency token — see UpdateEngineDto.updated_at.
  @IsOptional()
  @IsDateString()
  updated_at?: string;
}
