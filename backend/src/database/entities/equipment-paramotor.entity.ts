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
import { EquipmentEngine } from './equipment-engine.entity';
import { EquipmentReserve } from './equipment-reserve.entity';
import { EquipmentParamotorWing } from './equipment-paramotor-wing.entity';

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

  @Column({ type: 'uuid', nullable: true })
  reserve_id: string | null;

  @Column({ type: 'float', nullable: true })
  tank_size_litres: number | null;

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

  @ManyToOne(() => EquipmentReserve, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'reserve_id' })
  reserve: EquipmentReserve | null;

  // Not eager: logbook hours recalculation looks paramotors up frequently and
  // never needs the wing links; load explicitly via relations.
  @OneToMany(() => EquipmentParamotorWing, (link) => link.paramotor)
  wing_links: EquipmentParamotorWing[];
}
