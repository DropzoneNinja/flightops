import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdatePilotDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  display_name?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;
}
