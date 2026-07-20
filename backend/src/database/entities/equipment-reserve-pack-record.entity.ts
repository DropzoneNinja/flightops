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
import { EquipmentReserve } from './equipment-reserve.entity';

@Entity('equipment_reserve_packs')
export class ReservePackRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  reserve_id: string;

  @Column({ type: 'date' })
  pack_date: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => EquipmentReserve, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reserve_id' })
  reserve: EquipmentReserve;
}
