import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { FlightSite } from './flight-site.entity';
import { WeatherHourly } from './weather-hourly.entity';
import { WeatherMultiHeight } from './weather-multi-height.entity';

@Entity('weather_forecasts')
@Unique(['site_id', 'forecast_date'])
@Index(['site_id', 'forecast_date'])
export class WeatherForecast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  site_id: string;

  @Column({ type: 'date' })
  forecast_date: Date;

  @Column({ type: 'time' })
  sunrise: string;

  @Column({ type: 'time' })
  sunset: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @ManyToOne(() => FlightSite, (site) => site.forecasts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'site_id' })
  site: FlightSite;

  @OneToMany(() => WeatherHourly, (hourly) => hourly.forecast)
  hourly_data: WeatherHourly[];

  @OneToMany(() => WeatherMultiHeight, (multiHeight) => multiHeight.forecast)
  multi_height_data: WeatherMultiHeight[];
}
