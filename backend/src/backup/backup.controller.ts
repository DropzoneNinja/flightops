import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  /**
   * GET /backup/files
   * List available backup files (admin only)
   */
  @Get('files')
  async listBackupFiles() {
    const files = await this.backupService.listBackupFiles();
    return { files };
  }

  /**
   * POST /backup/restore
   * Restore database from existing backup file (admin only)
   */
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  async restoreFromBackup(@Body() body: { filename: string }) {
    if (!body.filename) {
      throw new BadRequestException('Filename is required');
    }

    const result = await this.backupService.restoreFromBackup(body.filename);

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      message: result.message,
      preRestoreBackup: result.preRestoreBackup,
    };
  }

  /**
   * POST /backup/upload
   * Upload backup file and optionally restore immediately (admin only)
   */
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.endsWith('.sql')) {
          return callback(
            new BadRequestException('Only .sql files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadBackup(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { restoreImmediately?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filename = await this.backupService.saveUploadedBackup(file);

    // Check if we should restore immediately
    const restoreImmediately = body.restoreImmediately === 'true';

    if (restoreImmediately) {
      const result = await this.backupService.restoreFromBackup(filename);
      if (!result.success) {
        throw new BadRequestException(result.error);
      }

      return {
        message: 'File uploaded and database restored successfully',
        filename,
        preRestoreBackup: result.preRestoreBackup,
      };
    }

    return {
      message: 'File uploaded successfully',
      filename,
    };
  }
}
