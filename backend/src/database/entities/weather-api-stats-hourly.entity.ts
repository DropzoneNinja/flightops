import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('weather_api_stats_hourly')
@Index(['hour_timestamp'], { unique: true })
@Index(['is_max'], { where: 'is_max = true' })
export class WeatherApiStatsHourly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', unique: true })
  hour_timestamp: Date; // Truncated to hour (e.g., '2024-01-15 14:00:00')

  @Column({ type: 'integer', default: 0 })
  total_calls: number;

  @Column({ type: 'boolean', default: false })
  is_max: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
