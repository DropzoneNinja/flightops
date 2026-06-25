import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { CreateLogbookEntryDto } from './create-logbook-entry.dto';

export class UpdateLogbookEntryDto extends PartialType(CreateLogbookEntryDto) {
  /** Set to a positive integer to pin this entry's flight number; null reverts to auto-numbering. */
  @IsOptional()
  @ValidateIf((o) => o.flight_number_override !== null)
  @IsInt()
  @Min(1)
  flight_number_override?: number | null;
}
