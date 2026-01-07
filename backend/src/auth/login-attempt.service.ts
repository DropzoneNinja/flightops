import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { LoginAttempt } from '../database/entities/login-attempt.entity';

@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);
  public readonly maxFailedAttempts: number;
  public readonly rateLimitWindowHours: number;

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
    private readonly configService: ConfigService,
  ) {
    this.maxFailedAttempts = this.configService.get<number>(
      'RATE_LIMIT_FAILED_ATTEMPTS_MAX',
      10,
    );
    this.rateLimitWindowHours = this.configService.get<number>(
      'RATE_LIMIT_FAILED_ATTEMPTS_WINDOW',
      24,
    );
  }

  /**
   * Log a login attempt
   */
  async logAttempt(
    email: string,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    const attempt = this.loginAttemptRepository.create({
      email,
      success,
      failure_reason: failureReason,
    });

    await this.loginAttemptRepository.save(attempt);

    // Log to console for debugging
    if (!success) {
      this.logger.warn(
        `Failed login attempt - Email: ${email}, Reason: ${failureReason}`,
      );
    }
  }

  /**
   * Check if email has exceeded failed attempt limit within the time window
   * Returns true if rate limit exceeded
   */
  async checkEmailRateLimit(email: string): Promise<boolean> {
    const windowStart = new Date();
    windowStart.setHours(
      windowStart.getHours() - this.rateLimitWindowHours,
    );

    const failedAttemptsInWindow = await this.loginAttemptRepository.count({
      where: {
        email: email,
        success: false,
        created_at: MoreThan(windowStart),
      },
    });

    return failedAttemptsInWindow >= this.maxFailedAttempts;
  }
}
