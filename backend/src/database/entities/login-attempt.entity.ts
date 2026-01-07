import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('login_attempts')
@Index('IDX_login_attempts_email_created', ['email', 'created_at'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ default: false })
  success: boolean;

  @Column({ length: 500, nullable: true })
  failure_reason: string;

  @CreateDateColumn()
  created_at: Date;
}
