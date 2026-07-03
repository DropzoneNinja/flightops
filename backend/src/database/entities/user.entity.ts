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

  @Column({ default: false })
  is_locked: boolean;

  @Column({ default: false })
  is_admin_locked: boolean;

  @Column({ default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  last_failed_login: Date;

  @Column({ type: 'timestamp', nullable: true })
  locked_at: Date;

  @Column({ type: 'bigint', default: 0 })
  storage_used: number;

  @Column({ type: 'bigint', default: 0 })
  images_viewed_count: number;

  @Column({ type: 'bigint', default: 0 })
  videos_viewed_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @OneToMany(() => FlightSite, (site) => site.user)
  flight_sites: FlightSite[];

  // Virtual field for password (not stored in DB)
  password?: string;

  // Hash password before inserting
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      // Use configurable bcrypt rounds (12-14 recommended for security)
      const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const salt = await bcrypt.genSalt(bcryptRounds);
      this.password_hash = await bcrypt.hash(this.password, salt);
      delete this.password; // Remove plain password
    }
  }

  // Method to validate password
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }
}
