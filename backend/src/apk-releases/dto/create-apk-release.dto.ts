import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateApkReleaseDto {
  @IsString()
  @IsNotEmpty()
  version_label: string;

  @IsString()
  @IsOptional()
  release_notes?: string;
}
