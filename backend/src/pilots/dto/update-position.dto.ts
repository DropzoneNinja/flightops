import { IsNumber, IsIn, IsOptional, Min, Max } from 'class-validator';

export class UpdatePositionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @IsOptional()
  @IsNumber()
  altitude_m?: number;

  @IsIn(['Flying', 'Landed'])
  state: 'Flying' | 'Landed';
}
