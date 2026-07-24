import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SetupUsernameDto, ResetPasswordDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * GET /auth/csrf-token
   * Get CSRF token for authenticated requests
   */
  @Get('csrf-token')
  getCsrfToken(@Req() req: Request) {
    return { csrfToken: req.csrfToken() };
  }

  /**
   * POST /auth/register
   * Register a new user
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * POST /auth/login
   * Login with email and password
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  async login(@CurrentUser() user: User) {
    return this.authService.login(user);
  }

  /**
   * POST /auth/setup-username
   * Setup username for existing users
   */
  @Post('setup-username')
  @UseGuards(JwtAuthGuard)
  async setupUsername(
    @CurrentUser() user: User,
    @Body() setupDto: SetupUsernameDto,
  ) {
    return this.authService.setupUsername(user.id, setupDto);
  }

  /**
   * GET /auth/check-username
   * Check if username is available
   */
  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    const available = await this.authService.checkUsernameAvailability(username);
    return { available };
  }

  /**
   * GET /auth/me
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: User) {
    const hasApkAccess = user.is_admin || (await this.usersService.hasApkAccess(user.id));
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      is_admin: user.is_admin,
      created_at: user.created_at,
      needs_username_setup: !user.username,
      needs_password_reset: user.needs_password_reset,
      has_apk_access: hasApkAccess,
    };
  }

  /**
   * PATCH /auth/reset-password
   * Reset user password
   */
  @Patch('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(
    @CurrentUser() user: User,
    @Body() resetDto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(user.id, resetDto.current_password, resetDto.new_password);
  }
}
