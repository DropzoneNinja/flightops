import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum BackupStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  IN_PROGRESS = 'in_progress',
}

export enum BackupType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  PRE_RESTORE = 'pre-restore',
  UPLOADED = 'uploaded',
}

@Entity('backup_history')
@Index(['created_at'])
export class BackupHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 20 })
  status: BackupStatus;

  @Column({ type: 'varchar', length: 20 })
  type: BackupType;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'bigint', nullable: true })
  file_size_bytes: number;

  @Column({ type: 'integer', nullable: true })
  duration_ms: number;

  @CreateDateColumn()
  created_at: Date;
}
