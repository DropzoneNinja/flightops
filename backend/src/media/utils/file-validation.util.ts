import { BadRequestException } from '@nestjs/common';
import * as FileType from 'file-type';
import * as path from 'path';

export interface FileValidationResult {
  isValid: boolean;
  mediaType: 'image' | 'video';
  mimeType: string;
  error?: string;
}

export class FileValidationUtil {
  // Allowed MIME types with their corresponding file extensions
  private static readonly ALLOWED_IMAGE_TYPES = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  private static readonly ALLOWED_VIDEO_TYPES = {
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'video/quicktime': ['.mov'],
  };

  private static readonly MAX_FILE_SIZE =
    parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 2147483648; // 2GB default

  /**
   * Validate file using magic numbers (file-type library)
   * This is more secure than trusting client-provided MIME types
   */
  static async validateFile(
    fileBuffer: Buffer,
    originalFilename: string,
    fileSize: number,
  ): Promise<FileValidationResult> {
    // Check file size first (before reading buffer completely)
    if (fileSize > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        mediaType: null,
        mimeType: null,
        error: `File size exceeds maximum allowed size of ${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB`,
      };
    }

    // Get actual file type from magic numbers
    const detectedType = await FileType.fromBuffer(fileBuffer);

    if (!detectedType) {
      return {
        isValid: false,
        mediaType: null,
        mimeType: null,
        error: 'Unable to determine file type',
      };
    }

    const { mime, ext } = detectedType;
    const fileExtension = path.extname(originalFilename).toLowerCase();

    // Check if file is an allowed image type
    if (this.ALLOWED_IMAGE_TYPES[mime]) {
      // Verify extension matches
      if (!this.ALLOWED_IMAGE_TYPES[mime].includes(fileExtension)) {
        return {
          isValid: false,
          mediaType: 'image',
          mimeType: mime,
          error: `File extension ${fileExtension} does not match detected MIME type ${mime}`,
        };
      }

      return {
        isValid: true,
        mediaType: 'image',
        mimeType: mime,
      };
    }

    // Check if file is an allowed video type
    if (this.ALLOWED_VIDEO_TYPES[mime]) {
      // Verify extension matches
      if (!this.ALLOWED_VIDEO_TYPES[mime].includes(fileExtension)) {
        return {
          isValid: false,
          mediaType: 'video',
          mimeType: mime,
          error: `File extension ${fileExtension} does not match detected MIME type ${mime}`,
        };
      }

      return {
        isValid: true,
        mediaType: 'video',
        mimeType: mime,
      };
    }

    // File type not allowed
    return {
      isValid: false,
      mediaType: null,
      mimeType: mime,
      error: `File type ${mime} is not allowed. Allowed types: JPEG, PNG, WebP, MP4, WebM, MOV`,
    };
  }

  /**
   * Sanitize filename to prevent directory traversal and other attacks
   */
  static sanitizeFilename(filename: string): string {
    // Remove any path components
    const basename = path.basename(filename);

    // Remove any characters that aren't alphanumeric, dash, underscore, or dot
    const sanitized = basename.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    // Limit filename length
    const maxLength = 255;
    if (sanitized.length > maxLength) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      return nameWithoutExt.substring(0, maxLength - ext.length) + ext;
    }

    return sanitized;
  }

  /**
   * Validate and throw exception if file is invalid
   */
  static async validateOrThrow(
    fileBuffer: Buffer,
    originalFilename: string,
    fileSize: number,
  ): Promise<FileValidationResult> {
    const result = await this.validateFile(
      fileBuffer,
      originalFilename,
      fileSize,
    );

    if (!result.isValid) {
      throw new BadRequestException(result.error);
    }

    return result;
  }

  /**
   * Get allowed file extensions as a string for error messages
   */
  static getAllowedExtensions(): string {
    const imageExts = Object.values(this.ALLOWED_IMAGE_TYPES).flat();
    const videoExts = Object.values(this.ALLOWED_VIDEO_TYPES).flat();
    return [...imageExts, ...videoExts].join(', ');
  }

  /**
   * Get maximum file size in a human-readable format
   */
  static getMaxFileSizeFormatted(): string {
    return `${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB`;
  }
}
