import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Media } from '../database/entities/media.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CreateMediaDto, UpdateMediaDto, BrowseMediaDto, MediaSortOption } from './dto';
import { FileValidationUtil } from './utils/file-validation.util';
import { ThumbnailUtil } from './utils/thumbnail.util';
import { MediaProbeUtil } from './utils/media-probe.util';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { UsersService } from '../users/users.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class MediaService {
  private readonly mediaStoragePath: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly usersService: UsersService,
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
   * Get all distinct, non-empty values of a plain-text media column (aircraft/wing/engine)
   */
  private async getUniqueTextColumn(column: 'aircraft' | 'wing' | 'engine'): Promise<string[]> {
    const result = await this.mediaRepository
      .createQueryBuilder('media')
      .select(`DISTINCT media.${column}`, 'value')
      .where(`media.${column} IS NOT NULL AND media.${column} != ''`)
      .orderBy('value', 'ASC')
      .getRawMany();

    return result.map((row) => row.value).filter(Boolean);
  }

  async getUniqueAircraft(): Promise<string[]> {
    return this.getUniqueTextColumn('aircraft');
  }

  async getUniqueWings(): Promise<string[]> {
    return this.getUniqueTextColumn('wing');
  }

  async getUniqueEngines(): Promise<string[]> {
    return this.getUniqueTextColumn('engine');
  }

  /**
   * Get all distinct tags across all media entries
   */
  async getUniqueTags(): Promise<string[]> {
    const result = await this.mediaRepository
      .createQueryBuilder('media')
      .select('DISTINCT unnest(media.tags)', 'tag')
      .where("media.tags != '{}'")
      .orderBy('tag', 'ASC')
      .getRawMany();

    return result.map((row) => row.tag).filter(Boolean);
  }

  /**
   * Get all distinct site countries referenced by media
   */
  async getUniqueCountries(): Promise<string[]> {
    const result = await this.mediaRepository
      .createQueryBuilder('media')
      .leftJoin('media.site', 'site')
      .select('DISTINCT site.country', 'country')
      .where('site.country IS NOT NULL')
      .orderBy('country', 'ASC')
      .getRawMany();

    return result.map((row) => row.country).filter(Boolean);
  }

  /**
   * Consolidated filter option lists for building a browse/search filter panel in one round trip
   */
  async getFilterOptions(): Promise<{
    pilots: string[];
    aircraft: string[];
    wings: string[];
    engines: string[];
    tags: string[];
    countries: string[];
    sites: Array<{
      site_id: string;
      site_name: string;
      takeoff_lat: number;
      takeoff_lon: number;
      image_count: number;
      video_count: number;
    }>;
  }> {
    const [pilots, aircraft, wings, engines, tags, countries, sites] = await Promise.all([
      this.getUniquePilots(),
      this.getUniqueAircraft(),
      this.getUniqueWings(),
      this.getUniqueEngines(),
      this.getUniqueTags(),
      this.getUniqueCountries(),
      this.getSitesWithMediaCounts(),
    ]);

    return { pilots, aircraft, wings, engines, tags, countries, sites };
  }

  /**
   * Paginated, filterable, sortable media library browse — backs FlightTV's Library/Search/Filters
   * screens and any other client that needs to page through the full media set.
   */
  async browseMedia(query: BrowseMediaDto): Promise<{
    items: Media[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .leftJoinAndSelect('media.site', 'site');

    if (query.q) {
      qb.andWhere(
        `(
          media.title ILIKE :q OR
          media.description ILIKE :q OR
          media.notes ILIKE :q OR
          media.original_filename ILIKE :q OR
          media.aircraft ILIKE :q OR
          media.wing ILIKE :q OR
          media.engine ILIKE :q OR
          site.name ILIKE :q OR
          EXISTS (SELECT 1 FROM unnest(media.pilots) p WHERE p ILIKE :q) OR
          EXISTS (SELECT 1 FROM unnest(media.tags) t WHERE t ILIKE :q)
        )`,
        { q: `%${query.q}%` },
      );
    }

    if (query.pilots?.length) {
      qb.andWhere('media.pilots && :pilots', { pilots: query.pilots });
    }
    if (query.site_id) {
      qb.andWhere('media.site_id = :siteId', { siteId: query.site_id });
    }
    if (query.country) {
      qb.andWhere('site.country ILIKE :country', { country: query.country });
    }
    if (query.year) {
      qb.andWhere('EXTRACT(YEAR FROM media.flight_date) = :year', { year: query.year });
    }
    if (query.month) {
      qb.andWhere('EXTRACT(MONTH FROM media.flight_date) = :month', { month: query.month });
    }
    if (query.flight_date_from) {
      qb.andWhere('media.flight_date >= :flightDateFrom', { flightDateFrom: query.flight_date_from });
    }
    if (query.flight_date_to) {
      qb.andWhere('media.flight_date <= :flightDateTo', { flightDateTo: query.flight_date_to });
    }
    if (query.uploaded_from) {
      qb.andWhere('media.created_at >= :uploadedFrom', { uploadedFrom: query.uploaded_from });
    }
    if (query.uploaded_to) {
      qb.andWhere('media.created_at <= :uploadedTo', { uploadedTo: query.uploaded_to });
    }
    if (query.aircraft?.length) {
      qb.andWhere('media.aircraft ILIKE ANY(:aircraft)', { aircraft: query.aircraft });
    }
    if (query.wings?.length) {
      qb.andWhere('media.wing ILIKE ANY(:wings)', { wings: query.wings });
    }
    if (query.engines?.length) {
      qb.andWhere('media.engine ILIKE ANY(:engines)', { engines: query.engines });
    }
    if (query.tags?.length) {
      qb.andWhere('media.tags && :tags', { tags: query.tags });
    }
    if (query.type) {
      qb.andWhere('media.media_type = :type', { type: query.type });
    }
    if (query.favorite !== undefined) {
      qb.andWhere('media.favorite = :favorite', { favorite: query.favorite === 'true' });
    }
    if (query.gps_track_available !== undefined) {
      const wantsGps = query.gps_track_available === 'true';
      qb.andWhere(wantsGps ? 'media.flight_id IS NOT NULL' : 'media.flight_id IS NULL');
    }
    if (query.min_rating !== undefined) {
      qb.andWhere('media.rating >= :minRating', { minRating: query.min_rating });
    }

    this.applySort(qb, query.sort ?? 'newest');

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    };
  }

  private applySort(qb: SelectQueryBuilder<Media>, sort: MediaSortOption): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('media.flight_date', 'ASC').addOrderBy('media.created_at', 'ASC');
        break;
      case 'recently_uploaded':
        qb.orderBy('media.created_at', 'DESC');
        break;
      case 'highest_rated':
        qb.orderBy('media.rating', 'DESC', 'NULLS LAST').addOrderBy('media.flight_date', 'DESC');
        break;
      case 'longest':
        qb.orderBy('media.duration_seconds', 'DESC', 'NULLS LAST');
        break;
      case 'shortest':
        qb.orderBy('media.duration_seconds', 'ASC', 'NULLS LAST');
        break;
      case 'pilot':
        qb.orderBy('media.pilots[1]', 'ASC', 'NULLS LAST');
        break;
      case 'location':
        qb.orderBy('site.name', 'ASC', 'NULLS LAST').addOrderBy('media.flight_date', 'DESC');
        break;
      case 'alphabetical':
        qb.orderBy('media.title', 'ASC', 'NULLS LAST').addOrderBy('media.original_filename', 'ASC');
        break;
      case 'newest':
      default:
        qb.orderBy('media.flight_date', 'DESC').addOrderBy('media.created_at', 'DESC');
        break;
    }
  }

  /**
   * Media related to the given item by flight, pilot, site, day, or shared tags.
   * Deduped and capped; each item is tagged with the first relation that matched it.
   */
  async getRelatedMedia(id: string, limit = 24): Promise<Array<Media & { relation: string }>> {
    const media = await this.getMediaById(id);
    const seen = new Set<string>([media.id]);
    const related: Array<Media & { relation: string }> = [];

    const addGroup = (items: Media[], relation: string) => {
      for (const item of items) {
        if (seen.has(item.id) || related.length >= limit) continue;
        seen.add(item.id);
        related.push(Object.assign(item, { relation }));
      }
    };

    if (media.flight_id) {
      const sameFlight = await this.mediaRepository.find({
        where: { flight_id: media.flight_id },
        relations: ['site'],
        take: limit,
      });
      addGroup(sameFlight.filter((m) => m.id !== media.id), 'same_flight');
    }

    if (related.length < limit && media.pilots?.length) {
      const samePilot = await this.mediaRepository
        .createQueryBuilder('media')
        .leftJoinAndSelect('media.site', 'site')
        .where('media.id != :id', { id: media.id })
        .andWhere('media.pilots && :pilots', { pilots: media.pilots })
        .orderBy('media.flight_date', 'DESC')
        .take(limit)
        .getMany();
      addGroup(samePilot, 'same_pilot');
    }

    if (related.length < limit && media.site_id) {
      const sameSite = await this.mediaRepository.find({
        where: { site_id: media.site_id },
        relations: ['site'],
        order: { flight_date: 'DESC' },
        take: limit,
      });
      addGroup(sameSite.filter((m) => m.id !== media.id), 'same_site');
    }

    if (related.length < limit) {
      const sameDay = await this.mediaRepository.find({
        where: { flight_date: media.flight_date },
        relations: ['site'],
        take: limit,
      });
      addGroup(sameDay.filter((m) => m.id !== media.id), 'same_day');
    }

    if (related.length < limit && media.tags?.length) {
      const similarTags = await this.mediaRepository
        .createQueryBuilder('media')
        .leftJoinAndSelect('media.site', 'site')
        .where('media.id != :id', { id: media.id })
        .andWhere('media.tags && :tags', { tags: media.tags })
        .orderBy('media.flight_date', 'DESC')
        .take(limit)
        .getMany();
      addGroup(similarTags, 'similar_tags');
    }

    return related.slice(0, limit);
  }

  /**
   * Batch-fetch media items by ID, e.g. to hydrate a client-side "Continue Watching" row
   * from locally-persisted playback progress without N round trips.
   */
  async getMediaBatch(ids: string[]): Promise<Media[]> {
    if (!ids.length) return [];
    const capped = ids.slice(0, 100);
    return this.mediaRepository.find({
      where: capped.map((id) => ({ id })),
      relations: ['site'],
    });
  }

  /**
   * Pre-computed sections for a TV-style home screen. Each row is capped server-side
   * so clients never need to page through the full library just to render a shelf.
   */
  async getHomeSections(limit = 20): Promise<{
    recentlyUploaded: Media[];
    recentlyFlown: Media[];
    newestVideos: Media[];
    newestPhotos: Media[];
    favoriteFlights: Media[];
    favoritePilots: Array<{ pilot: string; favoriteCount: number }>;
    popularSites: Array<{
      site_id: string;
      site_name: string;
      takeoff_lat: number;
      takeoff_lon: number;
      image_count: number;
      video_count: number;
    }>;
  }> {
    const [recentlyUploaded, recentlyFlown, newestVideos, newestPhotos, favoriteFlightsRaw, favoritePilots, sites] =
      await Promise.all([
        this.mediaRepository.find({ relations: ['site'], order: { created_at: 'DESC' }, take: limit }),
        this.mediaRepository.find({ relations: ['site'], order: { flight_date: 'DESC' }, take: limit }),
        this.mediaRepository.find({
          where: { media_type: 'video' },
          relations: ['site'],
          order: { flight_date: 'DESC' },
          take: limit,
        }),
        this.mediaRepository.find({
          where: { media_type: 'image' },
          relations: ['site'],
          order: { flight_date: 'DESC' },
          take: limit,
        }),
        this.mediaRepository.find({
          where: { favorite: true },
          relations: ['site'],
          order: { flight_date: 'DESC' },
          take: limit * 4, // over-fetch so we have enough after de-duping by flight below
        }),
        this.mediaRepository
          .createQueryBuilder('media')
          .select('unnest(media.pilots)', 'pilot')
          .addSelect('COUNT(*)', 'favoriteCount')
          .where('media.favorite = true')
          .andWhere("media.pilots != '{}'")
          .groupBy('pilot')
          .orderBy('"favoriteCount"', 'DESC')
          .limit(limit)
          .getRawMany(),
        this.getSitesWithMediaCounts(),
      ]);

    const favoriteFlights: Media[] = [];
    const seenFlights = new Set<string>();
    for (const item of favoriteFlightsRaw) {
      if (!item.flight_id || seenFlights.has(item.flight_id)) continue;
      seenFlights.add(item.flight_id);
      favoriteFlights.push(item);
      if (favoriteFlights.length >= limit) break;
    }

    const popularSites = sites
      .sort((a, b) => b.image_count + b.video_count - (a.image_count + a.video_count))
      .slice(0, limit);

    return {
      recentlyUploaded,
      recentlyFlown,
      newestVideos,
      newestPhotos,
      favoriteFlights,
      favoritePilots: favoritePilots.map((row) => ({
        pilot: row.pilot,
        favoriteCount: parseInt(row.favoriteCount, 10) || 0,
      })),
      popularSites,
    };
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
    flight_count: number;
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

    const mediaResult = await qb.getRawMany();

    let flightCountsByDate = new Map<string, number>();
    try {
      const flightCountsRaw: Array<{ date: string; flight_count: string }> =
        await this.mediaRepository.manager.query(
          `SELECT TO_CHAR(flight_date, 'YYYY-MM-DD') as date, COUNT(*) as flight_count FROM flights GROUP BY TO_CHAR(flight_date, 'YYYY-MM-DD')`
        );
      flightCountsByDate = new Map(
        flightCountsRaw.map((r) => [r.date, parseInt(r.flight_count, 10) || 0]),
      );
    } catch (e) {
      // flights table may not exist yet — degrade gracefully
    }

    // Build a map of media results for merging
    const mediaByDate = new Map(
      mediaResult.map((row) => [row.date, {
        image_count: parseInt(row.image_count, 10) || 0,
        video_count: parseInt(row.video_count, 10) || 0,
      }]),
    );

    // Union of all dates from media AND flights
    const allDates = new Set([...mediaByDate.keys(), ...flightCountsByDate.keys()]);

    return Array.from(allDates)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        image_count: mediaByDate.get(date)?.image_count ?? 0,
        video_count: mediaByDate.get(date)?.video_count ?? 0,
        flight_count: flightCountsByDate.get(date) ?? 0,
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
   * Get all media for a specific mission
   */
  async getMediaByMission(missionId: string): Promise<Media[]> {
    return this.mediaRepository.find({
      where: { mission_id: missionId },
      order: { created_at: 'DESC' },
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
    uploadedBy: string,
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

    // Probe intrinsic dimensions/duration so FlightTV-style clients can lay out
    // grids without downloading the full asset first
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    let videoWidth: number | null = null;
    let videoHeight: number | null = null;
    let durationSeconds: number | null = null;

    if (validationResult.mediaType === 'image') {
      const dims = await MediaProbeUtil.probeImage(absoluteFilePath);
      imageWidth = dims.width;
      imageHeight = dims.height;
    } else if (validationResult.mediaType === 'video') {
      const probe = await MediaProbeUtil.probeVideo(absoluteFilePath);
      videoWidth = probe.width;
      videoHeight = probe.height;
      durationSeconds = probe.durationSeconds;
    }

    // Create database record
    const media = this.mediaRepository.create({
      flight_date: flightDate,
      media_type: validationResult.mediaType,
      file_path: relativeFilePath,
      original_filename: sanitizedFilename,
      uploaded_by: uploadedBy,
      pilots: createMediaDto.pilots || [],
      notes: createMediaDto.notes,
      title: createMediaDto.title ?? null,
      description: createMediaDto.description ?? null,
      tags: createMediaDto.tags || [],
      aircraft: createMediaDto.aircraft ?? null,
      wing: createMediaDto.wing ?? null,
      engine: createMediaDto.engine ?? null,
      mime_type: validationResult.mimeType,
      file_size: file.size,
      thumbnail_path: thumbnailPath,
      site_id: createMediaDto.site_id,
      mission_id: createMediaDto.mission_id ?? null,
      flight_id: createMediaDto.flight_id ?? null,
      image_width: imageWidth,
      image_height: imageHeight,
      video_width: videoWidth,
      video_height: videoHeight,
      duration_seconds: durationSeconds,
    });

    const savedMedia = await this.mediaRepository.save(media);

    // Track storage used by uploader
    await this.usersService.adjustStorageUsed(uploadedBy, file.size);

    return savedMedia;
  }

  /**
   * Update metadata for an existing media item
   */
  async updateMedia(id: string, dto: UpdateMediaDto): Promise<Media> {
    const media = await this.getMediaById(id);

    if (dto.flight_date !== undefined) {
      media.flight_date = new Date(dto.flight_date);
    }
    if (dto.pilots !== undefined) {
      media.pilots = dto.pilots;
    }
    if (dto.notes !== undefined) {
      media.notes = dto.notes || null;
    }
    if (dto.site_id !== undefined) {
      media.site_id = dto.site_id || null;
    }
    if (dto.mission_id !== undefined) {
      media.mission_id = dto.mission_id || null;
    }
    if (dto.flight_id !== undefined) {
      media.flight_id = dto.flight_id || null;
    }
    if (dto.title !== undefined) {
      media.title = dto.title || null;
    }
    if (dto.description !== undefined) {
      media.description = dto.description || null;
    }
    if (dto.tags !== undefined) {
      media.tags = dto.tags;
    }
    if (dto.aircraft !== undefined) {
      media.aircraft = dto.aircraft || null;
    }
    if (dto.wing !== undefined) {
      media.wing = dto.wing || null;
    }
    if (dto.engine !== undefined) {
      media.engine = dto.engine || null;
    }

    return this.mediaRepository.save(media);
  }

  /**
   * Set the shared favorite flag on a media item (visible/settable by any authenticated viewer)
   */
  async setFavorite(id: string, favorite: boolean): Promise<Media> {
    const media = await this.getMediaById(id);
    media.favorite = favorite;
    return this.mediaRepository.save(media);
  }

  /**
   * Set the shared rating (0-5) on a media item
   */
  async setRating(id: string, rating: number): Promise<Media> {
    const media = await this.getMediaById(id);
    media.rating = rating;
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

    // Adjust storage used by uploader
    await this.usersService.adjustStorageUsed(media.uploaded_by, -media.file_size);
  }

  /**
   * Increment view count for a media item and track it against the viewing user
   */
  async incrementViewCount(id: string, viewerUsername?: string): Promise<void> {
    const media = await this.getMediaById(id);
    media.view_count += 1;
    await this.mediaRepository.save(media);
    if (viewerUsername) {
      await this.usersService.incrementViewedCount(viewerUsername, media.media_type);
    }
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
   * Regenerate thumbnails for all image media records.
   * Only processes images (videos are skipped as their thumbnails are still valid).
   * Returns counts of successes and failures.
   */
  async regenerateImageThumbnails(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; filename: string; error: string }>;
  }> {
    const images = await this.mediaRepository.find({
      where: { media_type: 'image' },
    });

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; filename: string; error: string }> = [];

    for (const media of images) {
      try {
        const absoluteFilePath = path.join(
          this.mediaStoragePath,
          media.file_path,
        );

        // Derive the date path from the stored file_path (YYYY-MM-DD/filename)
        const datePath = path.dirname(media.file_path);

        const thumbnailDir = await ThumbnailUtil.ensureThumbnailDirectory(
          this.mediaStoragePath,
          datePath,
        );

        const secureFilename = path.basename(media.file_path);

        const absoluteThumbnailPath = await ThumbnailUtil.generateImageThumbnail(
          absoluteFilePath,
          thumbnailDir,
          secureFilename,
        );

        const thumbnailPath = ThumbnailUtil.getRelativeThumbnailPath(
          absoluteThumbnailPath,
          this.mediaStoragePath,
        );

        media.thumbnail_path = thumbnailPath;
        await this.mediaRepository.save(media);
        succeeded++;
      } catch (error) {
        failed++;
        errors.push({
          id: media.id,
          filename: media.original_filename,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(
          `Failed to regenerate thumbnail for media ${media.id}:`,
          error,
        );
      }
    }

    return { processed: images.length, succeeded, failed, errors };
  }

  /**
   * Optimize video for streaming by moving metadata (moov atom) to the beginning
   * This enables immediate playback without downloading the entire file
   */
  private async optimizeVideoForStreaming(filePath: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      await execFileAsync('ffmpeg', [
        '-i', filePath,
        '-c', 'copy',
        '-movflags', 'faststart',
        tempPath,
        '-y',
      ]);

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
