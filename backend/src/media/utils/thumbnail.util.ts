import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';

export class ThumbnailUtil {
  private static readonly THUMBNAIL_WIDTH = 400;
  private static readonly THUMBNAIL_HEIGHT = 300;
  private static readonly THUMBNAIL_QUALITY = 80;
  private static readonly VIDEO_THUMBNAIL_TIMESTAMP = '00:00:01'; // 1 second into video

  /**
   * Generate thumbnail for an image using Sharp
   * Returns the path to the generated thumbnail (relative to media storage path)
   */
  static async generateImageThumbnail(
    sourceFilePath: string,
    outputDirectory: string,
    originalFilename: string,
  ): Promise<string> {
    const thumbnailFilename = this.getThumbnailFilename(originalFilename);
    const thumbnailPath = path.join(outputDirectory, thumbnailFilename);

    try {
      await sharp(sourceFilePath)
        .resize(this.THUMBNAIL_WIDTH, this.THUMBNAIL_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: this.THUMBNAIL_QUALITY,
          progressive: true,
        })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error('Failed to generate image thumbnail:', error);
      throw new Error('Failed to generate thumbnail for image');
    }
  }

  /**
   * Generate thumbnail for a video using FFmpeg
   * Returns the path to the generated thumbnail (relative to media storage path)
   */
  static async generateVideoThumbnail(
    sourceFilePath: string,
    outputDirectory: string,
    originalFilename: string,
  ): Promise<string> {
    const thumbnailFilename = this.getThumbnailFilename(originalFilename);
    const thumbnailPath = path.join(outputDirectory, thumbnailFilename);

    return new Promise((resolve, reject) => {
      ffmpeg(sourceFilePath)
        .screenshots({
          timestamps: [this.VIDEO_THUMBNAIL_TIMESTAMP],
          filename: thumbnailFilename,
          folder: outputDirectory,
          size: `${this.THUMBNAIL_WIDTH}x${this.THUMBNAIL_HEIGHT}`,
        })
        .on('end', () => {
          resolve(thumbnailPath);
        })
        .on('error', (err) => {
          console.error('Failed to generate video thumbnail:', err);
          reject(new Error('Failed to generate thumbnail for video'));
        });
    });
  }

  /**
   * Generate thumbnail filename from original filename
   * Replaces extension with .jpg and adds _thumb suffix
   */
  private static getThumbnailFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    return `${basename}_thumb.jpg`;
  }

  /**
   * Ensure thumbnail directory exists
   */
  static async ensureThumbnailDirectory(
    mediaStoragePath: string,
    datePath: string,
  ): Promise<string> {
    const thumbnailDir = path.join(
      mediaStoragePath,
      'thumbnails',
      datePath,
    );
    await fs.mkdir(thumbnailDir, { recursive: true });
    return thumbnailDir;
  }

  /**
   * Get relative thumbnail path for database storage
   */
  static getRelativeThumbnailPath(
    absoluteThumbnailPath: string,
    mediaStoragePath: string,
  ): string {
    return path.relative(mediaStoragePath, absoluteThumbnailPath);
  }
}
