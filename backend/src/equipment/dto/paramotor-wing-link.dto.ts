import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class ParamotorWingLinkDto {
  @IsUUID()
  wing_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuel_burn_lph?: number | null;
}
