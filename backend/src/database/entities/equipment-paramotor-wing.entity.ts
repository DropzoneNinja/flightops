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

@Entity('equipment_paramotor_wings')
@Index(['paramotor_id', 'wing_id'], { unique: true })
export class EquipmentParamotorWing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  paramotor_id: string;

  @Column({ type: 'uuid' })
  @Index()
  wing_id: string;

  // Fuel burn depends on the wing/motor combination, so it lives on the link
  @Column({ type: 'float', nullable: true })
  fuel_burn_lph: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne('EquipmentParamotor', 'wing_links', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paramotor_id' })
  paramotor: unknown;

  @ManyToOne(() => EquipmentWing, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'wing_id' })
  wing: EquipmentWing;
}
