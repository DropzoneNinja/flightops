import { IsBoolean } from 'class-validator';

export class FavoriteMediaDto {
  @IsBoolean()
  favorite: boolean;
}
