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
import { User } from './user.entity';

@Entity('equipment_wings')
@Index(['user_id'])
export class EquipmentWing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, nullable: true })
  manufacturer: string | null;

  @Column({ length: 255, nullable: true })
  model: string | null;

  @Column({ length: 50, nullable: true })
  size: string | null;

  @Column({ type: 'float', nullable: true })
  trim_speed_kmh: number | null;

  @Column({ type: 'float', default: 0 })
  base_hours: number;

  @Column({ type: 'float', default: 0 })
  total_hours: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
