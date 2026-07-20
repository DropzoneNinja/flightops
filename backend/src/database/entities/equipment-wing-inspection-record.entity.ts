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
import { EquipmentWing } from './equipment-wing.entity';

@Entity('equipment_wing_inspections')
export class WingInspectionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  wing_id: string;

  @Column({ type: 'date' })
  inspection_date: string;

  @Column({ length: 255 })
  inspection_type: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => EquipmentWing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wing_id' })
  wing: EquipmentWing;
}
