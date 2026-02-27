import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../database/entities/media.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CreateMediaDto } from './dto';
import { FileValidationUtil } from './utils/file-validation.util';
import { ThumbnailUtil } from './utils/thumbnail.util';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class MediaService {
  private readonly mediaStoragePath: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {
    this.mediaStoragePath = process.env.MEDIA_STORAGE_PATH || '/app/media';
  }

  /**
   * Get all distinct pilot names across all media entries
   */
  async getUniquePilots(): Promise<string[]> {
    const result = await this.mediaRepository
      .createQueryBuilder('media')
      .select('DISTINCT unnest(media.pilots)', 'pilot')
      .where("media.pilots != '{}'")
      .orderBy('pilot', 'ASC')
      .getRawMany();

    return result.map((row) => row.pilot).filter(Boolean);
  }

  /**
   * Get all sites with their media counts
   */
  async getSitesWithMediaCounts(filters?: {
    uploadedBy?: string;
    pilots?: string[];
    year?: number;
    month?: number;
  }): Promise<Array<{
    site_id: string;
    site_name: string;
    takeoff_lat: number;
    takeoff_lon: number;
    image_count: number;
    video_count: number;
  }>> {
    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .leftJoin('media.site', 'site')
      .select('media.site_id', 'site_id')
      .addSelect('site.name', 'site_name')
      .addSelect('site.takeoff_lat', 'takeoff_lat')
      .addSelect('site.takeoff_lon', 'takeoff_lon')
      .addSelect(
        "SUM(CASE WHEN media.media_type = 'image' THEN 1 ELSE 0 END)",
        'image_count',
      )
      .addSelect(
        "SUM(CASE WHEN media.media_type = 'video' THEN 1 ELSE 0 END)",
        'video_count',
      )
      .where('media.site_id IS NOT NULL');

    if (filters?.uploadedBy) {
      qb.andWhere('media.uploaded_by = :uploadedBy', { uploadedBy: filters.uploadedBy });
    }
    if (filters?.pilots?.length) {
      qb.andWhere('media.pilots && :pilots', { pilots: filters.pilots });
    }
    if (filters?.year) {
      qb.andWhere('EXTRACT(YEAR FROM media.flight_date) = :year', { year: filters.year });
    }
    if (filters?.month) {
      qb.andWhere('EXTRACT(MONTH FROM media.flight_date) = :month', { month: filters.month });
    }

    qb.groupBy('media.site_id')
      .addGroupBy('site.name')
      .addGroupBy('site.takeoff_lat')
      .addGroupBy('site.takeoff_lon');

    const result = await qb.getRawMany();

    return result.map((row) => ({
      site_id: row.site_id,
      site_name: row.site_name,
      takeoff_lat: parseFloat(row.takeoff_lat),
      takeoff_lon: parseFloat(row.takeoff_lon),
      image_count: parseInt(row.image_count, 10) || 0,
      video_count: parseInt(row.video_count, 10) || 0,
    }));
  }

  /**
   * Get all unique dates that have media
   */
  async getMediaDates(): Promise<string[]> {
    const result = await this.mediaRepository
      .createQueryBuilder('media')
      .select('DISTINCT DATE(media.flight_date)', 'date')
      .orderBy('date', 'DESC')
      .getRawMany();

    return result.map((row) => row.date);
  }

  /**
   * Get all unique dates with media counts (photos and videos)
   */
  async getMediaDatesWithCounts(filters?: {
    uploadedBy?: string;
    pilots?: string[];
    year?: number;
    month?: number;
  }): Promise<Array<{
    date: string;
    image_count: number;
    video_count: number;
  }>> {
    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .select("TO_CHAR(media.flight_date, 'YYYY-MM-DD')", 'date')
      .addSelect(
        "SUM(CASE WHEN media.media_type = 'image' THEN 1 ELSE 0 END)",
        'image_count',
      )
      .addSelect(
        "SUM(CASE WHEN media.media_type = 'video' THEN 1 ELSE 0 END)",
        'video_count',
      );

    if (filters?.uploadedBy) {
      qb.where('media.uploaded_by = :uploadedBy', { uploadedBy: filters.uploadedBy });
    }
    if (filters?.pilots?.length) {
      qb.andWhere('media.pilots && :pilots', { pilots: filters.pilots });
    }
    if (filters?.year) {
      qb.andWhere('EXTRACT(YEAR FROM media.flight_date) = :year', { year: filters.year });
    }
    if (filters?.month) {
      qb.andWhere('EXTRACT(MONTH FROM media.flight_date) = :month', { month: filters.month });
    }

    qb.groupBy("TO_CHAR(media.flight_date, 'YYYY-MM-DD')")
      .orderBy('date', 'DESC');

    const result = await qb.getRawMany();

    return result.map((row) => ({
      date: row.date,
      image_count: parseInt(row.image_count, 10) || 0,
      video_count: parseInt(row.video_count, 10) || 0,
    }));
  }

  /**
   * Search media by filters (uploaded_by, pilots, year, month)
   */
  async searchMedia(filters: {
    uploadedBy?: string;
    pilots?: string[];
    year?: number;
    month?: number;
  }): Promise<Media[]> {
    const hasFilter =
      !!filters.uploadedBy ||
      (filters.pilots?.length ?? 0) > 0 ||
      !!filters.year ||
      !!filters.month;

    if (!hasFilter) return [];

    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .leftJoinAndSelect('media.site', 'site')
      .orderBy('media.flight_date', 'DESC')
      .addOrderBy('media.created_at', 'ASC');

    if (filters.uploadedBy) {
      qb.andWhere('media.uploaded_by = :uploadedBy', { uploadedBy: filters.uploadedBy });
    }
    if (filters.pilots?.length) {
      qb.andWhere('media.pilots && :pilots', { pilots: filters.pilots });
    }
    if (filters.year) {
      qb.andWhere('EXTRACT(YEAR FROM media.flight_date) = :year', { year: filters.year });
    }
    if (filters.month) {
      qb.andWhere('EXTRACT(MONTH FROM media.flight_date) = :month', { month: filters.month });
    }

    return qb.getMany();
  }

  /**
   * Get all media for a specific date
   */
  async getMediaByDate(date: string): Promise<Media[]> {
    return this.mediaRepository.find({
      where: { flight_date: new Date(date) },
      order: { created_at: 'ASC' },
      relations: ['site'],
    });
  }

  /**
   * Get all media for a specific site
   */
  async getMediaBySite(siteId: string): Promise<Media[]> {
    return this.mediaRepository.find({
      where: { site_id: siteId },
      order: { flight_date: 'DESC', created_at: 'ASC' },
      relations: ['site'],
    });
  }

  /**
   * Get a single media item by ID
   */
  async getMediaById(id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({ where: { id } });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    return media;
  }

  /**
   * Upload a new media file
   */
  async uploadMedia(
    file: Express.Multer.File,
    createMediaDto: CreateMediaDto,
  ): Promise<Media> {
    // Validate file
    const validationResult = await FileValidationUtil.validateOrThrow(
      file.buffer,
      file.originalname,
      file.size,
    );

    // Sanitize original filename
    const sanitizedFilename = FileValidationUtil.sanitizeFilename(
      file.originalname,
    );

    // Generate secure filename with UUID
    const secureFilename = this.generateSecureFilename(sanitizedFilename);

    // Create date-based directory structure (YYYY-MM-DD)
    const flightDate = new Date(createMediaDto.flight_date);
    const datePath = flightDate.toISOString().split('T')[0]; // YYYY-MM-DD

    await this.ensureDirectoryExists(datePath);

    // Save file to disk
    const relativeFilePath = path.join(datePath, secureFilename);
    const absoluteFilePath = path.join(this.mediaStoragePath, relativeFilePath);

    await fs.writeFile(absoluteFilePath, file.buffer);

    // Optimize videos for streaming (move metadata to beginning for instant playback)
    if (validationResult.mediaType === 'video') {
      await this.optimizeVideoForStreaming(absoluteFilePath);
    }

    // Generate thumbnail
    let thumbnailPath: string | null = null;
    try {
      const thumbnailDir = await ThumbnailUtil.ensureThumbnailDirectory(
        this.mediaStoragePath,
        datePath,
      );

      if (validationResult.mediaType === 'image') {
        const absoluteThumbnailPath =
          await ThumbnailUtil.generateImageThumbnail(
            absoluteFilePath,
            thumbnailDir,
            secureFilename,
          );
        thumbnailPath = ThumbnailUtil.getRelativeThumbnailPath(
          absoluteThumbnailPath,
          this.mediaStoragePath,
        );
      } else if (validationResult.mediaType === 'video') {
        const absoluteThumbnailPath =
          await ThumbnailUtil.generateVideoThumbnail(
            absoluteFilePath,
            thumbnailDir,
            secureFilename,
          );
        thumbnailPath = ThumbnailUtil.getRelativeThumbnailPath(
          absoluteThumbnailPath,
          this.mediaStoragePath,
        );
      }
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      // Continue without thumbnail - not critical
    }

    // Create database record
    const media = this.mediaRepository.create({
      flight_date: flightDate,
      media_type: validationResult.mediaType,
      file_path: relativeFilePath,
      original_filename: sanitizedFilename,
      uploaded_by: createMediaDto.uploaded_by,
      pilots: createMediaDto.pilots || [],
      notes: createMediaDto.notes,
      mime_type: validationResult.mimeType,
      file_size: file.size,
      thumbnail_path: thumbnailPath,
      site_id: createMediaDto.site_id,
    });

    return this.mediaRepository.save(media);
  }

  /**
   * Delete a media item by ID
   */
  async deleteMedia(id: string): Promise<void> {
    const media = await this.getMediaById(id);

    // Delete files from disk
    const fullFilePath = path.join(this.mediaStoragePath, media.file_path);
    try {
      await fs.unlink(fullFilePath);
    } catch (error) {
      console.error(`Failed to delete file: ${fullFilePath}`, error);
    }

    // Delete thumbnail if exists
    if (media.thumbnail_path) {
      const fullThumbnailPath = path.join(
        this.mediaStoragePath,
        media.thumbnail_path,
      );
      try {
        await fs.unlink(fullThumbnailPath);
      } catch (error) {
        console.error(`Failed to delete thumbnail: ${fullThumbnailPath}`, error);
      }
    }

    // Delete database record
    await this.mediaRepository.remove(media);
  }

  /**
   * Increment view count for a media item
   */
  async incrementViewCount(id: string): Promise<void> {
    const media = await this.getMediaById(id);
    media.view_count += 1;
    await this.mediaRepository.save(media);
  }

  /**
   * Increment download count for a media item
   */
  async incrementDownloadCount(id: string): Promise<void> {
    const media = await this.getMediaById(id);
    media.download_count += 1;
    await this.mediaRepository.save(media);
  }

  /**
   * Generate a secure filename with UUID prefix
   */
  generateSecureFilename(originalFilename: string): string {
    const uuid = randomUUID();
    const ext = path.extname(originalFilename);
    return `${uuid}${ext}`;
  }

  /**
   * Create directory structure for a given date
   */
  async ensureDirectoryExists(datePath: string): Promise<void> {
    const fullPath = path.join(this.mediaStoragePath, datePath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  /**
   * Get the full file path for a media item
   */
  getFullFilePath(media: Media): string {
    return path.join(this.mediaStoragePath, media.file_path);
  }

  /**
   * Get the full thumbnail path for a media item
   */
  getFullThumbnailPath(media: Media): string | null {
    if (!media.thumbnail_path) {
      return null;
    }
    return path.join(this.mediaStoragePath, media.thumbnail_path);
  }

  /**
   * Optimize video for streaming by moving metadata (moov atom) to the beginning
   * This enables immediate playback without downloading the entire file
   */
  private async optimizeVideoForStreaming(filePath: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      // Use ffmpeg to rewrite the video with faststart flag
      // -movflags faststart moves the moov atom to the beginning of the file
      // -c copy means we're just copying streams, not re-encoding (fast!)
      await execAsync(
        `ffmpeg -i "${filePath}" -c copy -movflags faststart "${tempPath}" -y`,
      );

      // Replace original with optimized version
      await fs.rename(tempPath, filePath);
      console.log(`Video optimized for streaming: ${filePath}`);
    } catch (error) {
      console.error(`Failed to optimize video ${filePath}:`, error);

      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      // Don't throw - we can still serve the video, just not optimally
      console.warn('Continuing with unoptimized video');
    }
  }
}
