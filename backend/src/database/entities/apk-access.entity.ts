import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('apk_access')
@Index(['user_id'], { unique: true })
export class ApkAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  granted_by_user_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
