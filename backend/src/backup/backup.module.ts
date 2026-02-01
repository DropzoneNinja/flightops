import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupHistory } from '../database/entities/backup-history.entity';
import { SettingsModule } from '../settings/settings.module';
import { BackupService } from './backup.service';
import { BackupJob } from './jobs/backup.job';
import { BackupController } from './backup.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupHistory]),
    forwardRef(() => SettingsModule),
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupJob],
  exports: [BackupService, BackupJob],
})
export class BackupModule {}
