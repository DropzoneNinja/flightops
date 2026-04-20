import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Mission } from './mission.entity';

@Entity('mission_waypoints')
@Index(['mission_id', 'sort_order'])
export class MissionWaypoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  mission_id: string;

  @Column({ type: 'int' })
  sort_order: number;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude: number;

  @Column({ type: 'float', nullable: true })
  altitude: number | null;

  @Column({ type: 'float', nullable: true })
  planned_speed: number | null;

  @Column({ type: 'float', nullable: true })
  leg_minutes: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Mission, (mission) => mission.waypoints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;
}
