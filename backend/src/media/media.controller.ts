import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
  StreamableFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaTokenGuard } from '../auth/guards/media-token.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MediaTokenService } from '../auth/media-token.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { CreateMediaDto, UpdateMediaDto, BrowseMediaDto, FavoriteMediaDto, RateMediaDto } from './dto';
import { FlightsService } from '../flights/flights.service';
import * as fs from 'fs';
import { createReadStream, statSync } from 'fs';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly mediaTokenService: MediaTokenService,
    private readonly flightsService: FlightsService,
  ) {}

  /**
   * GET /media/browse
   * Paginated, filterable, sortable media library browse (page, pageSize, q, pilots,
   * site_id, country, year, month, flight_date_from/to, uploaded_from/to, aircraft,
   * wings, engines, tags, type, favorite, gps_track_available, min_rating, sort).
   * This is the general-purpose endpoint for library/search/filter UIs (e.g. FlightTV).
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get('browse')
  @UseGuards(JwtAuthGuard)
  async browseMedia(@Query() query: BrowseMediaDto, @CurrentUser() user: User) {
    return this.mediaService.browseMedia(query);
  }

  /**
   * GET /media/filters
   * Consolidated filter option lists (pilots, aircraft, wings, engines, tags, countries, sites)
   * for building a filter panel in one round trip.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get('filters')
  @UseGuards(JwtAuthGuard)
  async getFilterOptions(@CurrentUser() user: User) {
    return this.mediaService.getFilterOptions();
  }

  /**
   * GET /media/home?limit=20
   * Pre-computed home-screen sections (recently uploaded/flown, newest videos/photos,
   * favorite flights/pilots, popular sites). "Continue Watching" is intentionally omitted —
   * playback progress is persisted client-side; hydrate it via GET /media/batch.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get('home')
  @UseGuards(JwtAuthGuard)
  async getHomeSections(@Query('limit') limitParam: string, @CurrentUser() user: User) {
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    return this.mediaService.getHomeSections(limit);
  }

  /**
   * GET /media/batch?ids=uuid,uuid,uuid
   * Batch-fetch media items by ID (capped at 100), e.g. to hydrate a client-side
   * "Continue Watching" row from locally-persisted playback progress.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get('batch')
  @UseGuards(JwtAuthGuard)
  async getMediaBatch(@Query('ids') idsParam: string, @CurrentUser() user: User) {
    const ids = idsParam ? idsParam.split(',').map((id) => id.trim()).filter(Boolean) : [];
    return this.mediaService.getMediaBatch(ids);
  }

  /**
   * GET /media/search
   * Search media by filters: uploaded_by, pilots (comma-sep), year, month
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchMedia(
    @Query('uploaded_by') uploadedBy: string,
    @Query('pilots') pilotsParam: string,
    @Query('year') yearParam: string,
    @Query('month') monthParam: string,
    @CurrentUser() user: User,
  ) {
    const filters = {
      uploadedBy: uploadedBy || undefined,
      pilots: pilotsParam ? pilotsParam.split(',').filter(Boolean) : undefined,
      year: yearParam ? parseInt(yearParam, 10) : undefined,
      month: monthParam ? parseInt(monthParam, 10) : undefined,
    };
    return this.mediaService.searchMedia(filters);
  }

  /**
   * GET /media/pilots
   * Returns all distinct pilot names from media entries
   */
  @Get('pilots')
  @UseGuards(JwtAuthGuard)
  async getUniquePilots(@CurrentUser() user: User): Promise<string[]> {
    return this.mediaService.getUniquePilots();
  }

  /**
   * GET /media/sites/counts
   * Returns all sites with their media counts (supports filtering)
   */
  @Get('sites/counts')
  @UseGuards(JwtAuthGuard)
  async getSitesWithMediaCounts(
    @Query('uploaded_by') uploadedBy: string,
    @Query('pilots') pilotsParam: string,
    @Query('year') yearParam: string,
    @Query('month') monthParam: string,
    @CurrentUser() user: User,
  ) {
    const filters = {
      uploadedBy: uploadedBy || undefined,
      pilots: pilotsParam ? pilotsParam.split(',').filter(Boolean) : undefined,
      year: yearParam ? parseInt(yearParam, 10) : undefined,
      month: monthParam ? parseInt(monthParam, 10) : undefined,
    };
    return this.mediaService.getSitesWithMediaCounts(filters);
  }

  /**
   * GET /media/dates/counts
   * Returns all dates with photo/video counts (supports filtering)
   */
  @Get('dates/counts')
  @UseGuards(JwtAuthGuard)
  async getMediaDatesWithCounts(
    @Query('uploaded_by') uploadedBy: string,
    @Query('pilots') pilotsParam: string,
    @Query('year') yearParam: string,
    @Query('month') monthParam: string,
    @CurrentUser() user: User,
  ) {
    const filters = {
      uploadedBy: uploadedBy || undefined,
      pilots: pilotsParam ? pilotsParam.split(',').filter(Boolean) : undefined,
      year: yearParam ? parseInt(yearParam, 10) : undefined,
      month: monthParam ? parseInt(monthParam, 10) : undefined,
    };
    return this.mediaService.getMediaDatesWithCounts(filters);
  }

  /**
   * GET /media/dates
   * Returns all dates that contain media
   */
  @Get('dates')
  @UseGuards(JwtAuthGuard)
  async getMediaDates(@CurrentUser() user: User): Promise<string[]> {
    return this.mediaService.getMediaDates();
  }

  /**
   * GET /media/mission/:missionId
   * Returns all media associated with a specific mission
   */
  @Get('mission/:missionId')
  @UseGuards(JwtAuthGuard)
  async getMediaByMission(
    @Param('missionId') missionId: string,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.getMediaByMission(missionId);
  }

  /**
   * GET /media?date=YYYY-MM-DD&site=SITE_ID
   * Returns metadata for all media on a given day or for a specific site
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMedia(
    @Query('date') date: string,
    @Query('site') siteId: string,
    @CurrentUser() user: User,
  ) {
    if (date) {
      return this.mediaService.getMediaByDate(date);
    }
    if (siteId) {
      return this.mediaService.getMediaBySite(siteId);
    }
    return [];
  }

  /**
   * GET /media/:id/token
   * Generate a short-lived token for accessing media files
   * This token can be used in query parameters to access /media/:id/file and /media/:id/thumbnail
   * Token is valid for 5 minutes and specific to this media file
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get(':id/token')
  @UseGuards(JwtAuthGuard)
  async getMediaAccessToken(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ token: string; expiresIn: string; mediaId: string }> {
    // Verify media exists and user has access
    await this.mediaService.getMediaById(id);

    // Generate a short-lived, file-specific token
    const token = this.mediaTokenService.generateMediaToken(id, user.id);

    return {
      token,
      expiresIn: '5m',
      mediaId: id,
    };
  }

  /**
   * GET /media/:id/file
   * Streams the actual media file with Range support for videos
   * Requires a media access token obtained from GET /media/:id/token
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get(':id/file')
  @UseGuards(MediaTokenGuard)
  async getMediaFile(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
    @CurrentUser() user: User,
  ): Promise<void> {
    const media = await this.mediaService.getMediaById(id);
    const filePath = this.mediaService.getFullFilePath(media);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Media file not found on disk');
    }

    // Get file stats
    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set common headers
    res.set({
      'Content-Type': media.mime_type,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${media.original_filename}"`,
    });

    // Handle Range requests for video streaming
    if (range) {
      // Parse range header (e.g., "bytes=0-1023")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Validate range
      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`,
        });
        res.end();
        return;
      }

      // Set partial content headers
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize.toString(),
      });

      // Create read stream for the requested range
      const stream = createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // No range request - send entire file
      res.status(200).set({
        'Content-Length': fileSize.toString(),
      });

      const stream = createReadStream(filePath);
      stream.pipe(res);
    }
  }

  /**
   * GET /media/:id/thumbnail
   * Serves the generated thumbnail
   * Requires a media access token obtained from GET /media/:id/token
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get(':id/thumbnail')
  @UseGuards(MediaTokenGuard)
  async getMediaThumbnail(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: User,
  ): Promise<StreamableFile> {
    const media = await this.mediaService.getMediaById(id);
    const thumbnailPath = this.mediaService.getFullThumbnailPath(media);

    if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
      throw new NotFoundException('Thumbnail not found');
    }

    // Set headers for thumbnail
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    });

    const stream = createReadStream(thumbnailPath);
    return new StreamableFile(stream);
  }

  /**
   * POST /media/:id/view
   * Increment view count when media is opened in viewer
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  async incrementView(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string; view_count: number }> {
    await this.mediaService.incrementViewCount(id, user.username);
    const media = await this.mediaService.getMediaById(id);
    return {
      message: 'View count incremented',
      view_count: media.view_count,
    };
  }

  /**
   * POST /media/:id/download
   * Increment download count when user clicks download button
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Post(':id/download')
  @UseGuards(JwtAuthGuard)
  async incrementDownload(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string; download_count: number }> {
    await this.mediaService.incrementDownloadCount(id);
    const media = await this.mediaService.getMediaById(id);
    return {
      message: 'Download count incremented',
      download_count: media.download_count,
    };
  }

  /**
   * GET /media/:id/related?limit=24
   * Media related to this item by flight, pilot, site, day, or shared tags — deduped and
   * capped, each item tagged with which relation matched it.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get(':id/related')
  @UseGuards(JwtAuthGuard)
  async getRelatedMedia(
    @Param('id') id: string,
    @Query('limit') limitParam: string,
    @CurrentUser() user: User,
  ) {
    const limit = limitParam ? parseInt(limitParam, 10) : 24;
    return this.mediaService.getRelatedMedia(id, limit);
  }

  /**
   * GET /media/:id/flight
   * Read-only flight summary (duration, sites, altitude, speed, distance, pilot) for the
   * flight this media item is linked to, regardless of who owns that flight — media
   * browsing is shared/read-only. Returns null if the media has no linked flight.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Get(':id/flight')
  @UseGuards(JwtAuthGuard)
  async getMediaFlightSummary(@Param('id') id: string, @CurrentUser() user: User) {
    const media = await this.mediaService.getMediaById(id);
    if (!media.flight_id) {
      return null;
    }
    return this.flightsService.getDisplaySummary(media.flight_id);
  }

  /**
   * PATCH /media/:id/favorite
   * Set the shared favorite flag on a media item. Any authenticated user may toggle this
   * (favorite/rating are shared values, like view_count, not per-viewer).
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Patch(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async setFavorite(
    @Param('id') id: string,
    @Body() dto: FavoriteMediaDto,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.setFavorite(id, dto.favorite);
  }

  /**
   * PATCH /media/:id/rating
   * Set the shared 0-5 rating on a media item.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Patch(':id/rating')
  @UseGuards(JwtAuthGuard)
  async setRating(
    @Param('id') id: string,
    @Body() dto: RateMediaDto,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.setRating(id, dto.rating);
  }

  /**
   * GET /media/:id
   * Returns metadata for a single media item
   * IMPORTANT: This generic :id route must be defined AFTER all specific :id/* routes
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getMediaMetadata(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.getMediaById(id);
  }

  /**
   * POST /media/admin/regenerate-thumbnails
   * Regenerate thumbnails for all existing image media (admin only).
   * Fixes orientation issues caused by missing EXIF auto-rotation.
   * IMPORTANT: This route must be defined BEFORE the generic :id route
   */
  @Post('admin/regenerate-thumbnails')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async regenerateThumbnails(@CurrentUser() user: User) {
    return this.mediaService.regenerateImageThumbnails();
  }

  /**
   * POST /media
   * Upload a new media file
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 2147483648, // 2GB
      },
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body() createMediaDto: CreateMediaDto,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // The pilots array is now automatically transformed by the DTO's @Transform decorator
    return this.mediaService.uploadMedia(file, createMediaDto, user.username);
  }

  /**
   * PATCH /media/:id
   * Updates metadata for a media item (admin or uploader only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateMedia(
    @Param('id') id: string,
    @Body() updateMediaDto: UpdateMediaDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    const media = await this.mediaService.getMediaById(id);

    if (!user.is_admin && media.uploaded_by !== user.username) {
      throw new BadRequestException('You can only edit media that you uploaded');
    }

    return this.mediaService.updateMedia(id, updateMediaDto);
  }

  /**
   * DELETE /media/:id
   * Deletes a media item (admin or uploader only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteMedia(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    const media = await this.mediaService.getMediaById(id);

    // Check if user is admin or the uploader
    const isUploader = media.uploaded_by === user.username;
    const isAdmin = user.is_admin;

    if (!isAdmin && !isUploader) {
      throw new BadRequestException('You can only delete media that you uploaded');
    }

    await this.mediaService.deleteMedia(id);
    return { message: 'Media deleted successfully' };
  }
}
