import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Flight } from './flight.entity';

@Entity('flight_events')
@Index(['flight_id'])
export class FlightEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  flight_id: string;

  @Column({ type: 'varchar', length: 100 })
  // takeoff | landing | max_altitude | max_climb_rate | max_descent_rate |
  // max_groundspeed | longest_level | largest_turn | abrupt_change
  event_type: string;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date;

  @Column({ type: 'int', nullable: true })
  seq_start: number;

  @Column({ type: 'int', nullable: true })
  seq_end: number;

  @Column({ type: 'float', nullable: true })
  lon: number;

  @Column({ type: 'float', nullable: true })
  lat: number;

  @Column({ type: 'float', nullable: true })
  elevation_m: number;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @Column({ type: 'jsonb', nullable: true })
  payload_json: Record<string, unknown>;

  // Relationships
  @ManyToOne(() => Flight, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flight_id' })
  flight: Flight;
}
