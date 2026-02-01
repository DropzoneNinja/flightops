import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupJob } from './jobs/backup.job';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('backup')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly backupJob: BackupJob,
  ) {}

  /**
   * POST /backup/manual
   * Trigger a manual backup (admin only)
   */
  @Post('manual')
  @HttpCode(HttpStatus.OK)
  async triggerManualBackup() {
    await this.backupJob.triggerManualBackup();
    return { message: 'Backup completed successfully' };
  }

  /**
   * GET /backup/status
   * Get last backup status and timestamp (admin only)
   */
  @Get('status')
  async getBackupStatus() {
    const lastBackup = await this.backupService.getLastBackupStatus();
    return {
      lastBackup: lastBackup
        ? {
            filename: lastBackup.filename,
            status: lastBackup.status,
            type: lastBackup.type,
            timestamp: lastBackup.created_at,
            fileSize: lastBackup.file_size_bytes,
            duration: lastBackup.duration_ms,
            error: lastBackup.error_message,
          }
        : null,
    };
  }

  /**
   * GET /backup/history
   * Get backup history (admin only)
   */
  @Get('history')
  async getBackupHistory() {
    const history = await this.backupService.getBackupHistory(20);
    return { history };
  }

  /**
   * POST /backup/update-schedule
   * Update backup schedule based on current settings (admin only)
   * This should be called after backup settings are updated
   */
  @Post('update-schedule')
  @HttpCode(HttpStatus.OK)
  async updateSchedule() {
    await this.backupJob.updateSchedule();
    return { message: 'Backup schedule updated successfully' };
  }
}
