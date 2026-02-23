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

@Entity('media')
@Index(['flight_date'])
@Index(['site_id'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  flight_date: Date;

  @Column({ type: 'uuid', nullable: true })
  site_id: string;

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
}
