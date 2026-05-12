import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PreAuthorizedEmailsService } from '../pre-authorized-emails/pre-authorized-emails.service';
import { LoginAttemptService } from './login-attempt.service';
import { RegisterDto, LoginDto, SetupUsernameDto } from './dto';
import { User } from '../database/entities/user.entity';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly preAuthEmailsService: PreAuthorizedEmailsService,
    private readonly jwtService: JwtService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    // Validate email is pre-authorized
    const isAuthorized = await this.preAuthEmailsService.isEmailAuthorized(
      registerDto.email,
    );

    if (!isAuthorized) {
      // Generic error message - don't reveal if email is pre-authorized
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create user with username
    const user = await this.usersService.createWithUsername(
      registerDto.email,
      registerDto.username,
      registerDto.password,
    );

    // Mark email as used
    await this.preAuthEmailsService.markAsUsed(registerDto.email);

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_admin: user.is_admin,
        created_at: user.created_at,
        needs_password_reset: user.needs_password_reset,
      },
    };
  }

  /**
   * Login user
   */
  async login(user: User) {
    // Update last login timestamp
    await this.usersService.updateLastLogin(user.id);

    const token = this.generateToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_admin: user.is_admin,
        created_at: user.created_at,
        needs_username_setup: !user.username,
        needs_password_reset: user.needs_password_reset,
      },
    };
  }

  /**
   * Validate user credentials
   * Used by LocalStrategy
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      await this.loginAttemptService.logAttempt(
        email,
        false,
        'User not found',
      );
      return null;
    }

    // Check email-based rate limit AFTER user lookup
    const rateLimitExceeded = await this.loginAttemptService.checkEmailRateLimit(email);
    if (rateLimitExceeded) {
      await this.loginAttemptService.logAttempt(
        email,
        false,
        `Rate limit exceeded (${this.loginAttemptService.maxFailedAttempts} failed attempts in ${this.loginAttemptService.rateLimitWindowHours} hours)`,
      );
      throw new HttpException(
        'Too many failed login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check if failed attempts should be reset (older than 1 hour)
    if (user.last_failed_login) {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      if (user.last_failed_login < oneHourAgo) {
        // Reset failed attempts if last failure was more than 1 hour ago
        await this.usersService.resetFailedAttempts(user.id);
        user.failed_login_attempts = 0;
        user.is_locked = false;
      }
    }

    // Check if account is locked
    if (user.is_locked) {
      await this.loginAttemptService.logAttempt(
        email,
        false,
        'Account locked',
      );
      throw new UnauthorizedException(
        'Account is locked. Please contact an administrator.',
      );
    }

    // Validate password
    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      // Increment failed attempts and potentially lock account
      await this.usersService.incrementFailedAttempts(user.id);

      await this.loginAttemptService.logAttempt(
        email,
        false,
        'Invalid password',
      );
      return null;
    }

    // Successful login
    await this.loginAttemptService.logAttempt(email, true, null);

    // Reset failed attempts on successful login
    await this.usersService.resetFailedAttempts(user.id);

    // Remove password_hash before returning
    delete user.password_hash;
    return user;
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Setup username for existing users
   */
  async setupUsername(userId: string, setupDto: SetupUsernameDto) {
    const user = await this.usersService.setUsername(userId, setupDto.username);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_admin: user.is_admin,
        created_at: user.created_at,
      },
    };
  }

  /**
   * Check username availability
   */
  async checkUsernameAvailability(username: string): Promise<boolean> {
    return this.usersService.isUsernameAvailable(username);
  }

  /**
   * Reset user password
   */
  async resetPassword(userId: string, newPassword: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update password and clear reset flag
    await this.usersService.update(userId, {
      password: newPassword,
      needs_password_reset: false,
    });

    return {
      message: 'Password updated successfully',
    };
  }
}
