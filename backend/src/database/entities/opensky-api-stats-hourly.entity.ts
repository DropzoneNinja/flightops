import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('opensky_api_stats_hourly')
@Index(['hour_timestamp'], { unique: true })
@Index(['is_max'], { where: 'is_max = true' })
export class OpenSkyApiStatsHourly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', unique: true })
  hour_timestamp: Date; // truncated to the hour

  @Column({ type: 'integer', default: 0 })
  total_calls: number;

  @Column({ type: 'integer', default: 0 })
  rejected_calls: number; // 429 responses

  @Column({ type: 'boolean', default: false })
  is_max: boolean; // true for the hour with the highest total_calls

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
