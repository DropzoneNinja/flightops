import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { Media } from '../database/entities/media.entity';
import { Pilot } from '../database/entities/pilot.entity';

export interface AlbumStatRow {
  username: string;
  email: string;
  images_uploaded: number;
  videos_uploaded: number;
  images_viewed: number;
  videos_viewed: number;
  storage_used: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Pilot)
    private readonly pilotsRepository: Repository<Pilot>,
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

    await this.userRepository.save(user);

    // Create a linked pilot record using the username as display name.
    // If a pilot with the same slug already exists and is unclaimed, claim it.
    const slug = this.generatePilotSlug(username);
    const existingPilot = await this.pilotsRepository.findOne({ where: { slug } });
    if (existingPilot && !existingPilot.user_id) {
      existingPilot.user_id = user.id;
      await this.pilotsRepository.save(existingPilot);
    } else if (!existingPilot) {
      await this.pilotsRepository.save(
        this.pilotsRepository.create({ display_name: username, slug, user_id: user.id }),
      );
    }

    return user;
  }

  private generatePilotSlug(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

  /**
   * Adjust storage_used for a user by username (positive delta = add, negative = subtract)
   */
  async adjustStorageUsed(username: string, delta: number): Promise<void> {
    if (!username) return;
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ storage_used: () => `storage_used + ${delta}` })
      .where('username = :username', { username })
      .execute();
  }

  /**
   * Increment the per-user view counter when a user views an image or video
   */
  async incrementViewedCount(username: string, mediaType: 'image' | 'video'): Promise<void> {
    if (!username) return;
    const column = mediaType === 'image' ? 'images_viewed_count' : 'videos_viewed_count';
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ [column]: () => `${column} + 1` })
      .where('username = :username', { username })
      .execute();
  }

  /**
   * Get per-user album stats
   */
  async getAlbumStats(): Promise<AlbumStatRow[]> {
    const result = await this.userRepository
      .createQueryBuilder('u')
      .leftJoin(Media, 'm', 'm.uploaded_by = u.username')
      .select('u.username', 'username')
      .addSelect('u.email', 'email')
      .addSelect('u.storage_used', 'storage_used')
      .addSelect('u.images_viewed_count', 'images_viewed')
      .addSelect('u.videos_viewed_count', 'videos_viewed')
      .addSelect("SUM(CASE WHEN m.media_type = 'image' THEN 1 ELSE 0 END)", 'images_uploaded')
      .addSelect("SUM(CASE WHEN m.media_type = 'video' THEN 1 ELSE 0 END)", 'videos_uploaded')
      .groupBy('u.id')
      .addGroupBy('u.username')
      .addGroupBy('u.email')
      .addGroupBy('u.storage_used')
      .addGroupBy('u.images_viewed_count')
      .addGroupBy('u.videos_viewed_count')
      .orderBy('u.username', 'ASC')
      .getRawMany();

    return result.map((row) => ({
      username: row.username,
      email: row.email,
      images_uploaded: parseInt(row.images_uploaded, 10) || 0,
      videos_uploaded: parseInt(row.videos_uploaded, 10) || 0,
      images_viewed: Number(row.images_viewed) || 0,
      videos_viewed: Number(row.videos_viewed) || 0,
      storage_used: Number(row.storage_used) || 0,
    }));
  }
}
