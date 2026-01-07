import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PreAuthorizedEmailsService } from '../pre-authorized-emails/pre-authorized-emails.service';
import { RegisterDto, LoginDto, SetupUsernameDto } from './dto';
import { User } from '../database/entities/user.entity';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly preAuthEmailsService: PreAuthorizedEmailsService,
    private readonly jwtService: JwtService,
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
      },
    };
  }

  /**
   * Login user
   */
  async login(user: User) {
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
      },
    };
  }

  /**
   * Validate user credentials
   * Used by LocalStrategy
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      return null;
    }

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
}
