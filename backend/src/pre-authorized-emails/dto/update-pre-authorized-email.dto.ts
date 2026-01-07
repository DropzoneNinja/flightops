import { IsString, IsOptional } from 'class-validator';

export class UpdatePreAuthorizedEmailDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
