import { Injectable, Logger, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BackupHistory, BackupStatus, BackupType } from '../database/entities/backup-history.entity';
import { SettingsService } from '../settings/settings.service';
import { SettingKey } from '../settings/constants/default-settings';

const execFileAsync = promisify(execFile);

export interface BackupResult {
  success: boolean;
  filename?: string;
  error?: string;
  fileSize?: number;
  duration?: number;
}

export interface BackupFileInfo {
  filename: string;
  size: number;
  created: string;
  isValid: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  message?: string;
  error?: string;
  preRestoreBackup?: string;
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

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.dbName)) {
      throw new Error(
        `Invalid DATABASE_NAME "${this.dbName}": must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`,
      );
    }
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

      this.logger.log(`Executing pg_dump for ${this.dbName}...`);

      // Execute backup using execFile with array arguments to prevent command injection
      const { stderr } = await execFileAsync('pg_dump', [
        '-h', this.dbHost,
        '-p', this.dbPort,
        '-U', this.dbUser,
        '-d', this.dbName,
        '-f', filepath,
      ], {
        env: { ...process.env, PGPASSWORD: this.dbPassword },
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

  /**
   * List all backup files in BACKUP_DIR
   */
  async listBackupFiles(): Promise<BackupFileInfo[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles: BackupFileInfo[] = [];

      for (const filename of files) {
        if (!filename.endsWith('.sql')) {
          continue;
        }

        const filepath = path.join(this.backupDir, filename);
        try {
          const stats = await fs.stat(filepath);
          const validation = await this.validateBackupFile(filename);

          backupFiles.push({
            filename,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            isValid: validation.isValid,
          });
        } catch (error) {
          this.logger.warn(`Failed to get stats for ${filename}: ${error.message}`);
        }
      }

      // Sort by creation time, newest first
      backupFiles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      return backupFiles;
    } catch (error) {
      this.logger.error(`Failed to list backup files: ${error.message}`);
      return [];
    }
  }

  /**
   * Validate backup file format
   */
  async validateBackupFile(filename: string): Promise<ValidationResult> {
    // Check file extension
    if (!filename.endsWith('.sql')) {
      return { isValid: false, error: 'File must have .sql extension' };
    }

    // Prevent path traversal
    const sanitizedFilename = path.basename(filename);
    if (sanitizedFilename !== filename) {
      return { isValid: false, error: 'Invalid filename' };
    }

    // Cross-reference: only files tracked in backup_history (server-generated or
    // uploaded via the API) can be restored — blocks arbitrary files placed on disk.
    const historyEntry = await this.backupHistoryRepository.findOne({ where: { filename } });
    if (!historyEntry) {
      return {
        isValid: false,
        error: 'File not found in backup history — only files created or uploaded through this system can be restored',
      };
    }

    const filepath = path.join(this.backupDir, filename);

    try {
      await fs.access(filepath);

      // Read first 2KB and verify genuine pg_dump plain-SQL header markers.
      // A crafted file with just "-- PostgreSQL" passes the old single-string check;
      // these two markers appear together only in real pg_dump output.
      const fileHandle = await fs.open(filepath, 'r');
      const buffer = Buffer.alloc(2048);
      await fileHandle.read(buffer, 0, 2048, 0);
      await fileHandle.close();

      const content = buffer.toString('utf-8');
      if (
        !content.includes('-- PostgreSQL database dump') ||
        !content.includes('-- Dumped by pg_dump version')
      ) {
        return {
          isValid: false,
          error: 'File does not appear to be a valid pg_dump SQL file',
        };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message || 'Failed to validate file' };
    }
  }

  /**
   * Restore database from backup file
   */
  async restoreFromBackup(filename: string): Promise<RestoreResult> {
    this.logger.log(`Starting database restore from ${filename}`);

    // Validate the backup file
    const validation = await this.validateBackupFile(filename);
    if (!validation.isValid) {
      this.logger.error(`Invalid backup file: ${validation.error}`);
      return {
        success: false,
        error: validation.error,
      };
    }

    const filepath = path.join(this.backupDir, filename);

    try {
      // Step 1: Create pre-restore backup
      this.logger.log('Creating pre-restore safety backup...');
      const preRestoreResult = await this.executeBackup(BackupType.PRE_RESTORE);

      if (!preRestoreResult.success) {
        this.logger.error('Failed to create pre-restore backup');
        return {
          success: false,
          error: 'Failed to create pre-restore backup: ' + preRestoreResult.error,
        };
      }

      this.logger.log(`Pre-restore backup created: ${preRestoreResult.filename}`);

      // Step 2: Drop existing connections and restore database
      this.logger.log(`Restoring database from ${filename}...`);

      // Terminate other connections to the database
      try {
        await execFileAsync('psql', [
          '-h', this.dbHost,
          '-p', this.dbPort,
          '-U', this.dbUser,
          '-d', 'postgres',
          '-c', `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.dbName.replace(/'/g, "''")}' AND pid <> pg_backend_pid();`,
        ], {
          env: { ...process.env, PGPASSWORD: this.dbPassword },
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (error) {
        this.logger.warn(`Failed to terminate connections (this may be normal): ${error.message}`);
      }

      // Drop and recreate database
      await execFileAsync('psql', [
        '-h', this.dbHost,
        '-p', this.dbPort,
        '-U', this.dbUser,
        '-d', 'postgres',
        '-c', `DROP DATABASE IF EXISTS "${this.dbName.replace(/"/g, '""')}";`,
      ], {
        env: { ...process.env, PGPASSWORD: this.dbPassword },
        maxBuffer: 10 * 1024 * 1024,
      });

      await execFileAsync('psql', [
        '-h', this.dbHost,
        '-p', this.dbPort,
        '-U', this.dbUser,
        '-d', 'postgres',
        '-c', `CREATE DATABASE "${this.dbName.replace(/"/g, '""')}";`,
      ], {
        env: { ...process.env, PGPASSWORD: this.dbPassword },
        maxBuffer: 10 * 1024 * 1024,
      });

      // Restore from backup file
      const { stderr } = await execFileAsync('psql', [
        '-h', this.dbHost,
        '-p', this.dbPort,
        '-U', this.dbUser,
        '-d', this.dbName,
        '-f', filepath,
      ], {
        env: { ...process.env, PGPASSWORD: this.dbPassword },
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large restores
      });

      if (stderr && !stderr.includes('NOTICE')) {
        this.logger.warn(`psql stderr: ${stderr}`);
      }

      this.logger.log('Database restore completed successfully');

      // Step 3: Re-insert the pre-restore backup record
      // (it was lost when we dropped the database)
      this.logger.log('Re-inserting pre-restore backup record...');
      const preRestoreRecord = this.backupHistoryRepository.create({
        filename: preRestoreResult.filename,
        status: BackupStatus.SUCCESS,
        type: BackupType.PRE_RESTORE,
        file_size_bytes: preRestoreResult.fileSize,
        duration_ms: preRestoreResult.duration,
      });
      await this.backupHistoryRepository.save(preRestoreRecord);

      return {
        success: true,
        message: 'Database restored successfully',
        preRestoreBackup: preRestoreResult.filename,
      };
    } catch (error) {
      this.logger.error(`Database restore failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message || 'Unknown error during restore',
      };
    }
  }

  /**
   * Save uploaded backup file to BACKUP_DIR
   */
  async saveUploadedBackup(file: Express.Multer.File): Promise<string> {
    // Validate pg_dump header at the multer temp path before persisting.
    const fileHandle = await fs.open(file.path, 'r');
    const buffer = Buffer.alloc(2048);
    await fileHandle.read(buffer, 0, 2048, 0);
    await fileHandle.close();
    const content = buffer.toString('utf-8');

    if (
      !content.includes('-- PostgreSQL database dump') ||
      !content.includes('-- Dumped by pg_dump version')
    ) {
      throw new BadRequestException('File does not appear to be a valid pg_dump SQL file');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedOriginalName = path.basename(file.originalname);
    const filename = `uploaded_${timestamp}_${sanitizedOriginalName}`;
    const filepath = path.join(this.backupDir, filename);

    this.logger.log(`Saving uploaded backup file: ${filename}`);

    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.rename(file.path, filepath);

      // Record in backup_history so the cross-reference check in validateBackupFile
      // allows this file to be restored.
      const stats = await fs.stat(filepath);
      await this.backupHistoryRepository.save({
        filename,
        status: BackupStatus.SUCCESS,
        type: BackupType.UPLOADED,
        file_size_bytes: stats.size,
      });

      this.logger.log(`Uploaded backup saved: ${filename}`);
      return filename;
    } catch (error) {
      this.logger.error(`Failed to save uploaded backup: ${error.message}`);
      throw error;
    }
  }
}
