import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BackupHistory, BackupStatus, BackupType } from '../database/entities/backup-history.entity';
import { SettingsService } from '../settings/settings.service';
import { SettingKey } from '../settings/constants/default-settings';

const execAsync = promisify(exec);

export interface BackupResult {
  success: boolean;
  filename?: string;
  error?: string;
  fileSize?: number;
  duration?: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly dbHost: string;
  private readonly dbPort: string;
  private readonly dbUser: string;
  private readonly dbPassword: string;
  private readonly dbName: string;

  constructor(
    @InjectRepository(BackupHistory)
    private readonly backupHistoryRepository: Repository<BackupHistory>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
  ) {
    this.backupDir = this.configService.get<string>('BACKUP_DIR', '/backups');
    this.dbHost = this.configService.get<string>('DATABASE_HOST', 'localhost');
    this.dbPort = this.configService.get<string>('DATABASE_PORT', '5432');
    this.dbUser = this.configService.get<string>('DATABASE_USER', 'flightops');
    this.dbPassword = this.configService.get<string>('DATABASE_PASSWORD', '');
    this.dbName = this.configService.get<string>('DATABASE_NAME', 'flightops');
  }

  /**
   * Execute a database backup
   */
  async executeBackup(type: BackupType = BackupType.SCHEDULED): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Get frequency for filename
    let frequency = 'manual';
    if (type === BackupType.SCHEDULED) {
      try {
        frequency = await this.settingsService.getValue(SettingKey.BACKUP_FREQUENCY) as string;
      } catch (error) {
        this.logger.warn('Failed to get backup frequency, using "scheduled" as default');
        frequency = 'scheduled';
      }
    }

    const filename = `flightops_${frequency}_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    this.logger.log(`Starting ${type} backup (${frequency}): ${filename}`);

    // Create backup history record
    const backupRecord = this.backupHistoryRepository.create({
      filename,
      status: BackupStatus.IN_PROGRESS,
      type,
    });
    await this.backupHistoryRepository.save(backupRecord);

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Build pg_dump command
      const pgDumpCmd = `PGPASSWORD="${this.dbPassword}" pg_dump -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} -f ${filepath}`;

      this.logger.log(`Executing pg_dump for ${this.dbName}...`);

      // Execute backup
      const { stdout, stderr } = await execAsync(pgDumpCmd, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      if (stderr) {
        this.logger.warn(`pg_dump stderr: ${stderr}`);
      }

      // Get file size
      const stats = await fs.stat(filepath);
      const fileSize = stats.size;
      const duration = Date.now() - startTime;

      this.logger.log(
        `Backup completed successfully: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB, ${duration}ms)`,
      );

      // Update backup record
      backupRecord.status = BackupStatus.SUCCESS;
      backupRecord.file_size_bytes = fileSize;
      backupRecord.duration_ms = duration;
      await this.backupHistoryRepository.save(backupRecord);

      return {
        success: true,
        filename,
        fileSize,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';

      this.logger.error(`Backup failed: ${errorMessage}`, error.stack);

      // Update backup record
      backupRecord.status = BackupStatus.FAILED;
      backupRecord.error_message = errorMessage;
      backupRecord.duration_ms = duration;
      await this.backupHistoryRepository.save(backupRecord);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get last backup status
   */
  async getLastBackupStatus(): Promise<BackupHistory | null> {
    const results = await this.backupHistoryRepository.find({
      order: { created_at: 'DESC' },
      take: 1,
    });

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get backup history
   */
  async getBackupHistory(limit = 20): Promise<BackupHistory[]> {
    return this.backupHistoryRepository.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Delete old backup records (not the files themselves)
   */
  async cleanupOldRecords(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.backupHistoryRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old backup records`);
    return result.affected || 0;
  }
}
