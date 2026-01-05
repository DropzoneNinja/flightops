import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('settings')
@Unique(['user_id', 'setting_key'])
@Index(['user_id', 'setting_key'])
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ length: 100 })
  setting_key: string;

  @Column({ type: 'text' })
  setting_value: string;

  @Column({ length: 50 })
  setting_type: string; // 'string', 'number', 'json', 'boolean'

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.settings, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
