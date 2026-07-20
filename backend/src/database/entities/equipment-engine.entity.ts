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
import { User } from './user.entity';

@Entity('equipment_engines')
@Index(['user_id'])
export class EquipmentEngine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ length: 255 })
  name: string;

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

  // Back-reference so we can eager-load paramotors if needed
  @OneToMany('EquipmentParamotor', 'engine')
  paramotors: unknown[];
}
