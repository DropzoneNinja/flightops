import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('weather_api_logs')
@Index(['endpoint'])
@Index(['created_at'])
export class WeatherApiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @CreateDateColumn()
  created_at: Date;
}
