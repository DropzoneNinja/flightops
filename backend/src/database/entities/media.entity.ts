import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('media')
@Index(['flight_date'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  flight_date: Date;

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
