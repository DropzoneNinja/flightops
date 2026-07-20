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
import { EquipmentEngine } from './equipment-engine.entity';

@Entity('equipment_engine_services')
export class EngineServiceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  engine_id: string;

  @Column({ type: 'date' })
  service_date: string;

  @Column({ length: 255 })
  service_type: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => EquipmentEngine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'engine_id' })
  engine: EquipmentEngine;
}
