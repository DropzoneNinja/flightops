import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('opensky_api_stats_daily')
@Index(['date'], { unique: true })
@Index(['is_max'], { where: 'is_max = true' })
export class OpenSkyApiStatsDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  date: string; // YYYY-MM-DD

  @Column({ type: 'integer', default: 0 })
  total_calls: number;

  @Column({ type: 'integer', default: 0 })
  rejected_calls: number; // 429 responses

  @Column({ type: 'boolean', default: false })
  is_max: boolean; // true for the day with the highest total_calls

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
