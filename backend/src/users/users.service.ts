import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   */
  async create(email: string, password: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user with hashed password
    const user = this.userRepository.create({
      email,
      password_hash,
    });

    return this.userRepository.save(user);
  }

  /**
   * Create a new user with username
   */
  async createWithUsername(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    const existingUsername = await this.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user with hashed password and username
    const user = this.userRepository.create({
      email,
      username,
      password_hash,
    });

    return this.userRepository.save(user);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Find user by email with password (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password_hash')
      .getOne();
  }

  /**
   * Get user profile by ID
   */
  async getProfile(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, updates);
    return this.userRepository.save(user);
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return user === null;
  }

  /**
   * Set username for existing user
   */
  async setUsername(userId: string, username: string): Promise<User> {
    // Check if username is available
    const existingUsername = await this.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.username = username;
    return this.userRepository.save(user);
  }

  /**
   * Get all users (admin only)
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get all usernames (for pilot selection in media uploads)
   */
  async getAllUsernames(): Promise<string[]> {
    const users = await this.userRepository.find({
      select: ['username'],
      order: { username: 'ASC' },
    });
    // Filter out users without usernames and return sorted list
    return users
      .map(u => u.username)
      .filter(username => username !== null && username !== undefined && username !== '')
      .sort();
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      last_login: new Date(),
    });
  }

  /**
   * Set password reset flag for a user
   */
  async setPasswordResetFlag(userId: string, needsReset: boolean): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.needs_password_reset = needsReset;
    return this.userRepository.save(user);
  }

  /**
   * Increment failed login attempts and lock if needed
   */
  async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      return;
    }

    user.failed_login_attempts += 1;
    user.last_failed_login = new Date();

    // Lock account after 3 failed attempts
    if (user.failed_login_attempts >= 3) {
      user.is_locked = true;
      user.locked_at = new Date();
    }

    await this.userRepository.save(user);
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failed_login_attempts: 0,
      last_failed_login: null,
      is_locked: false,
      locked_at: null,
    });
  }

  /**
   * Unlock a user account
   */
  async unlockAccount(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_locked = false;
    user.locked_at = null;
    user.failed_login_attempts = 0;
    user.last_failed_login = null;

    return this.userRepository.save(user);
  }
}
