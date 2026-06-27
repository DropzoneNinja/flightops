import { PartialType } from '@nestjs/mapped-types';
import { CreateParamotorDto } from './create-paramotor.dto';

export class UpdateParamotorDto extends PartialType(CreateParamotorDto) {}
