import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class PlotPointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}

export class PlotDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlotPointDto)
  @ArrayMinSize(2, { message: 'Plot must have at least 2 points' })
  @ArrayMaxSize(100, { message: 'Plot cannot exceed 100 points' })
  points: PlotPointDto[];
}
