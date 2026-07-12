import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FlightSite } from './flight-site.entity';
import { Mission } from './mission.entity';
import { Flight } from './flight.entity';

@Entity('media')
@Index(['flight_date'])
@Index(['site_id'])
@Index(['mission_id'])
@Index(['flight_id'])
@Index(['favorite'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  flight_date: Date;

  @Column({ type: 'uuid', nullable: true })
  site_id: string;

  @Column({ type: 'uuid', nullable: true })
  mission_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  flight_id: string | null;

  @Column({
    type: 'enum',
    enum: ['image', 'video'],
  })
  media_type: 'image' | 'video';

  @Column({ type: 'text' })
  file_path: string; // Relative to MEDIA_STORAGE_PATH

  @Column({ type: 'text' })
  original_filename: string;

  @Column({ type: 'text' })
  uploaded_by: string;

  @Column({ type: 'text', array: true, default: '{}' })
  pilots: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  aircraft: string | null;

  @Column({ type: 'text', nullable: true })
  wing: string | null;

  @Column({ type: 'text', nullable: true })
  engine: string | null;

  @Column({ type: 'boolean', default: false })
  favorite: boolean;

  @Column({ type: 'smallint', nullable: true })
  rating: number | null;

  @Column({ type: 'real', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'int', nullable: true })
  image_width: number | null;

  @Column({ type: 'int', nullable: true })
  image_height: number | null;

  @Column({ type: 'int', nullable: true })
  video_width: number | null;

  @Column({ type: 'int', nullable: true })
  video_height: number | null;

  @Column({ type: 'text' })
  mime_type: string;

  @Column({ type: 'bigint' })
  file_size: number;

  @Column({ type: 'text', nullable: true })
  thumbnail_path: string; // Generated thumbnail for videos and images

  @Column({ type: 'int', default: 0 })
  view_count: number;

  @Column({ type: 'int', default: 0 })
  download_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @ManyToOne(() => FlightSite, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'site_id' })
  site: FlightSite;

  @ManyToOne(() => Mission, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @ManyToOne(() => Flight, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'flight_id' })
  flight: Flight;
}
