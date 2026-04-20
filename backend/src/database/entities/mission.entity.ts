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
import { FlightSite } from './flight-site.entity';
import { MissionWaypoint } from './mission-waypoint.entity';
import { User } from './user.entity';

@Entity('missions')
@Index(['launch_site_id'])
@Index(['updated_at'])
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  launch_site_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'float', nullable: true })
  avg_fuel_consumption: number | null;

  @Column({ type: 'float', nullable: true })
  fuel_tank_size: number | null;

  @Column({ type: 'float', nullable: true })
  avg_speed: number | null;

  @Column({ type: 'float', nullable: true })
  wind_direction: number | null;

  @Column({ type: 'float', nullable: true })
  wind_speed: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => FlightSite, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'launch_site_id' })
  launch_site: FlightSite | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @OneToMany(() => MissionWaypoint, (wp) => wp.mission, {
    cascade: true,
    eager: false,
  })
  waypoints: MissionWaypoint[];
}
