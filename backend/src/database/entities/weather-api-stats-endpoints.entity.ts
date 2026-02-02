import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('weather_api_stats_endpoints')
@Index(['endpoint'], { unique: true })
export class WeatherApiStatsEndpoints {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  endpoint: string;

  @Column({ type: 'integer', default: 0 })
  total_calls: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
