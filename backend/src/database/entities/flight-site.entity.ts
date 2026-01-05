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
} from 'typeorm';
import { User } from './user.entity';
import { WeatherForecast } from './weather-forecast.entity';

@Entity('flight_sites')
@Index(['user_id'])
@Index(['takeoff_lat', 'takeoff_lon'])
export class FlightSite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  takeoff_lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  takeoff_lon: number;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  parking_lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  parking_lon: number;

  @Column({ type: 'text', nullable: true })
  takeoff_notes: string;

  @Column({ type: 'text', nullable: true })
  parking_notes: string;

  @Column({ type: 'text', nullable: true })
  weather_notes: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.flight_sites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => WeatherForecast, (forecast) => forecast.site)
  forecasts: WeatherForecast[];
}
