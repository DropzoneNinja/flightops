import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  current_password: string;

  @IsString()
  @MinLength(9, { message: 'Password must be at least 9 characters long' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  })
  new_password: string;
}
