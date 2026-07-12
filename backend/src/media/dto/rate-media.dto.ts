import { IsInt, Max, Min } from 'class-validator';

export class RateMediaDto {
  @IsInt()
  @Min(0)
  @Max(5)
  rating: number;
}
