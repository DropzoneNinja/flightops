import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreatePilotDto {
  @IsString()
  @MaxLength(255)
  display_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string; // auto-generated from display_name if not provided

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;
}
