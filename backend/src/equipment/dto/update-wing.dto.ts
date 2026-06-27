import { PartialType } from '@nestjs/mapped-types';
import { CreateWingDto } from './create-wing.dto';

export class UpdateWingDto extends PartialType(CreateWingDto) {}
