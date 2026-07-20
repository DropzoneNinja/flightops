import { PartialType } from '@nestjs/mapped-types';
import { CreateEngineServiceRecordDto } from './create-engine-service-record.dto';

export class UpdateEngineServiceRecordDto extends PartialType(CreateEngineServiceRecordDto) {}
