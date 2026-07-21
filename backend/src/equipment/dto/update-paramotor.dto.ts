import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateParamotorDto } from './create-paramotor.dto';

export class UpdateParamotorDto extends PartialType(CreateParamotorDto) {
  // Optional optimistic-concurrency token — see UpdateEngineDto.updated_at.
  // Paramotor is the highest-risk record for whole-record client pushes
  // (engine_id/reserve_id FKs can be clobbered by a sibling-field edit sent
  // from a stale snapshot), so clients should adopt this here first.
  @IsOptional()
  @IsDateString()
  updated_at?: string;
}
