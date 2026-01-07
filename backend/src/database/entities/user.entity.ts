import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { FlightSite } from './flight-site.entity';
import { Setting } from './setting.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 50, nullable: true })
  username: string;

  @Column({ length: 255, select: false })
  password_hash: string;

  @Column({ default: false })
  is_admin: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @Column({ default: false })
  needs_password_reset: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @OneToMany(() => FlightSite, (site) => site.user)
  flight_sites: FlightSite[];

  @OneToMany(() => Setting, (setting) => setting.user)
  settings: Setting[];

  // Virtual field for password (not stored in DB)
  password?: string;

  // Hash password before inserting
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      const salt = await bcrypt.genSalt(10);
      this.password_hash = await bcrypt.hash(this.password, salt);
      delete this.password; // Remove plain password
    }
  }

  // Method to validate password
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }
}
