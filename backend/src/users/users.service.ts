import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { Media } from '../database/entities/media.entity';
import { Pilot } from '../database/entities/pilot.entity';
import { ApkAccess } from '../database/entities/apk-access.entity';

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
    @InjectRepository(ApkAccess)
    private readonly apkAccessRepository: Repository<ApkAccess>,
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
   * Find user by ID with password hash included (for password change verification)
   */
  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
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
   * Get all users (admin only), each annotated with has_apk_access
   * (whether they've been explicitly granted the Flightoid APK page —
   * independent of is_admin, which always grants it regardless of this flag)
   */
  async findAll(): Promise<Array<User & { has_apk_access: boolean }>> {
    const [users, accessRows] = await Promise.all([
      this.userRepository.find({ order: { created_at: 'DESC' } }),
      this.apkAccessRepository.find(),
    ]);
    const accessUserIds = new Set(accessRows.map((row) => row.user_id));
    return users.map((user) =>
      Object.assign(user, { has_apk_access: accessUserIds.has(user.id) }),
    );
  }

  /**
   * Whether a user has been explicitly granted access to the Flightoid APK
   * download page. Does NOT factor in is_admin — callers that need "can this
   * user reach the feature" should OR this with user.is_admin themselves.
   */
  async hasApkAccess(userId: string): Promise<boolean> {
    const row = await this.apkAccessRepository.findOne({ where: { user_id: userId } });
    return row !== null;
  }

  /**
   * Grant a user access to the Flightoid APK download page (admin action)
   */
  async grantApkAccess(userId: string, grantedByUserId: string): Promise<void> {
    const existing = await this.apkAccessRepository.findOne({ where: { user_id: userId } });
    if (existing) return;
    await this.apkAccessRepository.save(
      this.apkAccessRepository.create({ user_id: userId, granted_by_user_id: grantedByUserId }),
    );
  }

  /**
   * Revoke a user's access to the Flightoid APK download page (admin action)
   */
  async revokeApkAccess(userId: string): Promise<void> {
    await this.apkAccessRepository.delete({ user_id: userId });
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
   * Flag a user for password reset. When flagging (needsReset = true), also
   * issues a new temporary password and returns it in plaintext — this is
   * the only time it's ever available, since the app has no email capability
   * to deliver it and the admin must relay it to the user out of band. The
   * user's real password is overwritten, so login always requires proof of
   * the temp password rather than trusting the reset flag alone (see
   * VULN-01 in CYBER-REVIEW.md for why the flag can't bypass password
   * validation).
   */
  async setPasswordResetFlag(
    userId: string,
    needsReset: boolean,
  ): Promise<{ user: User; tempPassword?: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.needs_password_reset = needsReset;

    let tempPassword: string | undefined;
    if (needsReset) {
      tempPassword = this.generateTempPassword();
      user.password = tempPassword;
    }

    const saved = await this.userRepository.save(user);
    return { user: saved, tempPassword };
  }

  /**
   * Generates a cryptographically random temporary password satisfying the
   * app's password policy (9+ chars, 1+ uppercase, 1+ digit). Excludes
   * visually ambiguous characters (0/O, 1/I/l) so it's easy to relay/type.
   */
  private generateTempPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const pick = (charset: string) => charset[randomInt(charset.length)];

    const chars = [pick(upper), pick(digits)];
    while (chars.length < 12) {
      chars.push(pick(all));
    }

    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
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
   * Lock a user account (admin action — sets is_admin_locked so it survives auto-unlock)
   */
  async lockAccount(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_admin_locked = true;
    user.locked_at = new Date();

    return this.userRepository.save(user);
  }

  /**
   * Unlock a user account — clears both auto-lock and admin-lock
   */
  async unlockAccount(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_locked = false;
    user.is_admin_locked = false;
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
      .set({ storage_used: () => 'storage_used + :delta' })
      .setParameter('delta', delta)
      .where('username = :username', { username })
      .execute();
  }

  /**
   * Increment the per-user view counter when a user views an image or video
   */
  async incrementViewedCount(username: string, mediaType: 'image' | 'video'): Promise<void> {
    if (!username) return;
    const qb = this.userRepository
      .createQueryBuilder()
      .update(User)
      .where('username = :username', { username });
    if (mediaType === 'image') {
      await qb.set({ images_viewed_count: () => 'images_viewed_count + 1' }).execute();
    } else {
      await qb.set({ videos_viewed_count: () => 'videos_viewed_count + 1' }).execute();
    }
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
