import { PartialType } from '@nestjs/mapped-types';
import { CreateReserveInspectionRecordDto } from './create-reserve-inspection-record.dto';

export class UpdateReserveInspectionRecordDto extends PartialType(CreateReserveInspectionRecordDto) {}
