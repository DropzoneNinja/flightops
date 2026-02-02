import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('weather_api_stats_daily')
@Index(['date'], { unique: true })
@Index(['is_max'], { where: 'is_max = true' })
export class WeatherApiStatsDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  date: string; // YYYY-MM-DD format

  @Column({ type: 'integer', default: 0 })
  total_calls: number;

  @Column({ type: 'boolean', default: false })
  is_max: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
