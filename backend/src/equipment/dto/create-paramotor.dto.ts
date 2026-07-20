import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParamotorWingLinkDto } from './paramotor-wing-link.dto';

export class CreateParamotorDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsUUID()
  engine_id?: string;

  @IsOptional()
  @IsUUID()
  reserve_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tank_size_litres?: number;

  // Omitted = leave wing links untouched (on update); [] = clear; array = full replace
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParamotorWingLinkDto)
  wings?: ParamotorWingLinkDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  base_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_hours?: number;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string;
}
