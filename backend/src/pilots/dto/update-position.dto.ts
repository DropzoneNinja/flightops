import { IsNumber, IsIn, Min, Max } from 'class-validator';

export class UpdatePositionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @IsIn(['Flying', 'Landed'])
  state: 'Flying' | 'Landed';
}
