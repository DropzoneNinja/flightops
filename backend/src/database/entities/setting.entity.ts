import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('settings')
@Unique(['setting_key'])
@Index(['setting_key'])
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  setting_key: string;

  @Column({ type: 'text' })
  setting_value: string;

  @Column({ length: 50 })
  setting_type: string; // 'string', 'number', 'json', 'boolean'

  @UpdateDateColumn()
  updated_at: Date;
}
