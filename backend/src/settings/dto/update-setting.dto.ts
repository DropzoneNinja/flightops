import { IsString, IsNotEmpty, IsIn, ValidateIf } from 'class-validator';
import { SettingType } from '../constants/default-settings';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  setting_key: string;

  @IsNotEmpty()
  @ValidateIf((o) => o.setting_type === SettingType.NUMBER)
  setting_value: string | number | boolean;

  @IsString()
  @IsIn([SettingType.NUMBER, SettingType.STRING, SettingType.BOOLEAN])
  setting_type: SettingType;
}

export class UpdateSettingsDto {
  settings: UpdateSettingDto[];
}
