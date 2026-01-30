import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { WeatherForecast } from './weather-forecast.entity';

@Entity('weather_hourly')
@Unique(['forecast_id', 'timestamp'])
@Index(['forecast_id', 'timestamp'])
export class WeatherHourly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  forecast_id: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  temperature: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_speed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_direction: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  gust_speed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  gust_spread: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rain: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  cloud_cover: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  cloud_base: number | null;

  @Column({ type: 'integer' })
  wind_score: number;

  @Column({ type: 'integer' })
  gust_score: number;

  @Column({ type: 'integer' })
  gust_spread_score: number;

  @Column({ type: 'integer' })
  rain_score: number;

  @Column({ type: 'integer', default: 100 })
  cloud_score: number;

  @Column({ type: 'integer' })
  overall_score: number;

  @CreateDateColumn()
  created_at: Date;

  // Relationships
  @ManyToOne(() => WeatherForecast, (forecast) => forecast.hourly_data, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'forecast_id' })
  forecast: WeatherForecast;
}
