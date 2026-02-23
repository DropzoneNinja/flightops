import {
  Controller,
  Get,
  Post,
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
import { CreateMediaDto } from './dto';
import * as fs from 'fs';
import { createReadStream, statSync } from 'fs';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly mediaTokenService: MediaTokenService,
  ) {}

  /**
   * GET /media/sites/counts
   * Returns all sites with their media counts
   */
  @Get('sites/counts')
  @UseGuards(JwtAuthGuard)
  async getSitesWithMediaCounts(@CurrentUser() user: User) {
    return this.mediaService.getSitesWithMediaCounts();
  }

  /**
   * GET /media/dates/counts
   * Returns all dates with photo/video counts
   */
  @Get('dates/counts')
  @UseGuards(JwtAuthGuard)
  async getMediaDatesWithCounts(@CurrentUser() user: User) {
    return this.mediaService.getMediaDatesWithCounts();
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
   * POST /media
   * Upload a new media file
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 524288000, // 500MB
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
    return this.mediaService.uploadMedia(file, createMediaDto);
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
