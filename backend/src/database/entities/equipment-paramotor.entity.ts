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
import { EquipmentEngine } from './equipment-engine.entity';

@Entity('equipment_paramotors')
@Index(['user_id'])
export class EquipmentParamotor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  engine_id: string | null;

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

  @ManyToOne(() => EquipmentEngine, 'paramotors', { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'engine_id' })
  engine: EquipmentEngine | null;
}
