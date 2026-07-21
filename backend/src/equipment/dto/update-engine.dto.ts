import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateEngineDto } from './create-engine.dto';

export class UpdateEngineDto extends PartialType(CreateEngineDto) {
  // Optional optimistic-concurrency token: pass back the updated_at you last
  // fetched. If it no longer matches the server's, the update is rejected
  // with 409 instead of silently overwriting a concurrent change. Omit to
  // get the old unconditional-overwrite behavior.
  @IsOptional()
  @IsDateString()
  updated_at?: string;
}
