import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('apk_releases')
export class ApkRelease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  version_label: string;

  @Column({ type: 'text', nullable: true })
  release_notes: string | null;

  @Column({ type: 'text' })
  original_filename: string;

  @Column({ type: 'text' })
  file_path: string; // Relative to APK_STORAGE_PATH

  @Column({ type: 'bigint' })
  file_size: number;

  @Column({ type: 'text' })
  uploaded_by: string;

  @CreateDateColumn()
  created_at: Date;
}
