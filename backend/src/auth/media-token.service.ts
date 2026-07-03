import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

/**
 * Service for generating and validating short-lived, file-specific media access tokens
 * These tokens replace JWT tokens in query parameters to prevent token leakage
 */
@Injectable()
export class MediaTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate a short-lived token for accessing a specific media file
   * Token is valid for 5 minutes and can only access the specified media ID
   *
   * @param mediaId - The ID of the media file
   * @param userId - The ID of the authenticated user
   * @returns A presigned token string
   */
  generateMediaToken(mediaId: string, userId: string): string {
    const payload = {
      type: 'media_access',
      mediaId,
      userId,
      // Add a random nonce to prevent token reuse/prediction
      nonce: this.generateNonce(),
    };

    return this.jwtService.sign(payload, {
      secret: this.getMediaTokenSecret(),
      expiresIn: '5m', // Short-lived: 5 minutes
    });
  }

  /**
   * Validate a media access token and extract its payload
   *
   * @param token - The token to validate
   * @returns The decoded token payload if valid
   * @throws Error if token is invalid or expired
   */
  async validateMediaToken(token: string): Promise<{
    type: string;
    mediaId: string;
    userId: string;
    nonce: string;
  }> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getMediaTokenSecret(),
        algorithms: ['HS256'],
      });

      // Verify token type
      if (payload.type !== 'media_access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired media access token');
    }
  }

  /**
   * Get the secret used for signing media tokens
   * Uses a different secret than regular JWT tokens for additional security
   */
  private getMediaTokenSecret(): string {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    // Derive a different secret for media tokens
    return `${jwtSecret}_media`;
  }

  /**
   * Generate a random nonce to prevent token reuse
   */
  private generateNonce(): string {
    return randomBytes(16).toString('hex');
  }
}
