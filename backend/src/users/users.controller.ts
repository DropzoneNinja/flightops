import { Controller, Get, Delete, Patch, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };
  }

  /**
   * GET /users/usernames
   * Get all usernames (for pilot selection)
   */
  @Get('usernames')
  @UseGuards(JwtAuthGuard)
  async getUsernames() {
    return this.usersService.getAllUsernames();
  }

  /**
   * GET /users/album-stats
   * Get per-user album statistics (all authenticated users)
   */
  @Get('album-stats')
  @UseGuards(JwtAuthGuard)
  async getAlbumStats() {
    return this.usersService.getAlbumStats();
  }

  /**
   * GET /users
   * Get all users (admin only)
   */
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * DELETE /users/:id
   * Delete a user (admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    // Prevent admin from deleting themselves
    if (id === currentUser.id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    // Check if this is the last admin
    const allUsers = await this.usersService.findAll();
    const adminCount = allUsers.filter(u => u.is_admin).length;
    const userToDelete = await this.usersService.findById(id);

    if (userToDelete && userToDelete.is_admin && adminCount <= 1) {
      throw new ForbiddenException('Cannot delete the last admin user');
    }

    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }

  /**
   * PATCH /users/:id/reset-password
   * Flag user for password reset on next login (admin only)
   */
  @Patch(':id/reset-password')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async flagPasswordReset(@Param('id') id: string) {
    const user = await this.usersService.setPasswordResetFlag(id, true);
    return {
      message: 'User will be required to reset password on next login',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        needs_password_reset: user.needs_password_reset,
      },
    };
  }

  /**
   * PATCH /users/:id/unlock
   * Unlock a locked user account (admin only)
   */
  @Patch(':id/unlock')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async unlockAccount(@Param('id') id: string) {
    const user = await this.usersService.unlockAccount(id);
    return {
      message: 'User account unlocked successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_locked: user.is_locked,
        failed_login_attempts: user.failed_login_attempts,
      },
    };
  }
}
