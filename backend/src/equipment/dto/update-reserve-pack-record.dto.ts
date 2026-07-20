import { PartialType } from '@nestjs/mapped-types';
import { CreateReservePackRecordDto } from './create-reserve-pack-record.dto';

export class UpdateReservePackRecordDto extends PartialType(CreateReservePackRecordDto) {}
