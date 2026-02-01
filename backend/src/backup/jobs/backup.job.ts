import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BackupService } from '../backup.service';
import { SettingsService } from '../../settings/settings.service';
import { SettingKey } from '../../settings/constants/default-settings';
import { BackupType } from '../../database/entities/backup-history.entity';

@Injectable()
export class BackupJob implements OnModuleInit {
  private readonly logger = new Logger(BackupJob.name);
  private readonly JOB_NAME = 'database-backup';
  private isRunning = false;

  constructor(
    private readonly backupService: BackupService,
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Initialize backup job on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing backup job...');
    await this.updateSchedule();
  }

  /**
   * Update backup schedule based on current settings
   * This should be called whenever backup settings are changed
   */
  async updateSchedule(): Promise<void> {
    this.logger.log('Updating backup schedule...');

    // Remove existing job if it exists
    try {
      const existingJob = this.schedulerRegistry.getCronJob(this.JOB_NAME);
      if (existingJob) {
        existingJob.stop();
        this.schedulerRegistry.deleteCronJob(this.JOB_NAME);
        this.logger.log('Stopped existing backup job');
      }
    } catch (error) {
      // Job doesn't exist, which is fine
    }

    // Check if backups are enabled
    const enabled = await this.settingsService.getValue(
      SettingKey.BACKUP_ENABLED,
    ) as boolean;

    if (!enabled) {
      this.logger.log('Backups are disabled');
      return;
    }

    // Get backup settings
    const frequency = await this.settingsService.getValue(
      SettingKey.BACKUP_FREQUENCY,
    ) as string;
    const time = await this.settingsService.getValue(
      SettingKey.BACKUP_TIME,
    ) as string;
    const dayOfWeek = await this.settingsService.getValue(
      SettingKey.BACKUP_DAY_OF_WEEK,
    ) as string;
    const dayOfMonth = await this.settingsService.getValue(
      SettingKey.BACKUP_DAY_OF_MONTH,
    ) as string;

    // Parse time (HH:mm format)
    const [hours, minutes] = time.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      this.logger.error(`Invalid backup time format: ${time}`);
      return;
    }

    // Build cron expression
    let cronExpression: string;

    switch (frequency) {
      case 'daily':
        // Every day at specified time
        cronExpression = `${minutes} ${hours} * * *`;
        break;
      case 'weekly':
        // Specific day of week at specified time
        cronExpression = `${minutes} ${hours} * * ${dayOfWeek}`;
        break;
      case 'monthly':
        // Specific day of month at specified time
        cronExpression = `${minutes} ${hours} ${dayOfMonth} * *`;
        break;
      default:
        this.logger.error(`Invalid backup frequency: ${frequency}`);
        return;
    }

    this.logger.log(
      `Scheduling ${frequency} backup at ${time} (cron: ${cronExpression})`,
    );

    // Create and register new cron job
    const job = new CronJob(cronExpression, async () => {
      await this.handleScheduledBackup();
    });

    this.schedulerRegistry.addCronJob(this.JOB_NAME, job);
    job.start();

    this.logger.log('Backup job scheduled successfully');
  }

  /**
   * Handle scheduled backup execution
   */
  private async handleScheduledBackup(): Promise<void> {
    // Prevent overlapping executions
    if (this.isRunning) {
      this.logger.warn('Backup already running, skipping this execution');
      return;
    }

    try {
      this.isRunning = true;
      this.logger.log('Starting scheduled backup...');

      const result = await this.backupService.executeBackup(BackupType.SCHEDULED);

      if (result.success) {
        this.logger.log(`Scheduled backup completed successfully: ${result.filename}`);
      } else {
        this.logger.error(`Scheduled backup failed: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Scheduled backup error: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Trigger manual backup
   */
  async triggerManualBackup(): Promise<void> {
    this.logger.log('Triggering manual backup...');

    const result = await this.backupService.executeBackup(BackupType.MANUAL);

    if (!result.success) {
      throw new Error(result.error || 'Backup failed');
    }
  }
}
