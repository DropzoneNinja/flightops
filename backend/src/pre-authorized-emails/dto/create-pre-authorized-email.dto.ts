import { IsEmail, IsString, IsOptional } from 'class-validator';

export class CreatePreAuthorizedEmailDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
