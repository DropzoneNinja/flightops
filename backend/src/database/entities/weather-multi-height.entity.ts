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

@Entity('weather_multi_height')
@Unique(['forecast_id', 'timestamp'])
@Index(['forecast_id', 'timestamp'])
export class WeatherMultiHeight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  forecast_id: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // Wind data at 10m height
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_speed_10m: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_direction_10m: number;

  // Wind data at 80m height
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_speed_80m: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_direction_80m: number;

  // Wind data at 120m height
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_speed_120m: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  wind_direction_120m: number;

  @CreateDateColumn()
  created_at: Date;

  // Relationships
  @ManyToOne(() => WeatherForecast, (forecast) => forecast.multi_height_data, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'forecast_id' })
  forecast: WeatherForecast;
}
