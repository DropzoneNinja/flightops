import { IsString, IsNotEmpty, IsIn, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { SettingType } from '../constants/default-settings';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  setting_key: string;

  @IsNotEmpty()
  setting_value: string | number | boolean;

  @IsString()
  @IsIn([SettingType.NUMBER, SettingType.STRING, SettingType.BOOLEAN])
  setting_type: SettingType;
}

export class UpdateSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSettingDto)
  settings: UpdateSettingDto[];
}
