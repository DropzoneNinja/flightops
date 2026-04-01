import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Flight } from './flight.entity';

@Entity('flight_scores')
export class FlightScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  flight_id: string;

  @Column({ type: 'varchar', length: 50 })
  scoring_version: string;

  @Column({ type: 'float' })
  overall_score: number;

  @Column({ type: 'float', nullable: true })
  takeoff_score: number;

  @Column({ type: 'float', nullable: true })
  climb_score: number;

  @Column({ type: 'float', nullable: true })
  level_score: number;

  @Column({ type: 'float', nullable: true })
  turn_score: number;

  @Column({ type: 'float', nullable: true })
  descent_score: number;

  @Column({ type: 'float', nullable: true })
  landing_score: number;

  @Column({ type: 'float', nullable: true })
  smoothness_score: number;

  @Column({ type: 'float', nullable: true })
  safety_score: number;

  @Column({ type: 'jsonb', nullable: true })
  explanation_json: string[]; // array of coaching comment strings

  @CreateDateColumn()
  created_at: Date;

  // Relationships
  @OneToOne(() => Flight, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flight_id' })
  flight: Flight;
}
