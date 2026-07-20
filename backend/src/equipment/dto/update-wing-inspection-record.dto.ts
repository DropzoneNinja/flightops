import { PartialType } from '@nestjs/mapped-types';
import { CreateWingInspectionRecordDto } from './create-wing-inspection-record.dto';

export class UpdateWingInspectionRecordDto extends PartialType(CreateWingInspectionRecordDto) {}
