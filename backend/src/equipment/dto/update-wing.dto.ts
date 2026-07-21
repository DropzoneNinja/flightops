import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateWingDto } from './create-wing.dto';

export class UpdateWingDto extends PartialType(CreateWingDto) {
  // Optional optimistic-concurrency token — see UpdateEngineDto.updated_at.
  @IsOptional()
  @IsDateString()
  updated_at?: string;
}
