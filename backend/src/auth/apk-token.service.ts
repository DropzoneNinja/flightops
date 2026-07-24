import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

/**
 * Short-lived, release-specific download tokens for /apk-releases/:id/file.
 * Modeled on MediaTokenService but kept separate so a token can never be
 * replayed against the media endpoints (and vice versa).
 */
@Injectable()
export class ApkTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateApkToken(releaseId: string, userId: string): string {
    const payload = {
      type: 'apk_access',
      releaseId,
      userId,
      nonce: randomBytes(16).toString('hex'),
    };

    return this.jwtService.sign(payload, {
      secret: this.getApkTokenSecret(),
      expiresIn: '5m',
    });
  }

  async validateApkToken(token: string): Promise<{
    type: string;
    releaseId: string;
    userId: string;
    nonce: string;
  }> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getApkTokenSecret(),
        algorithms: ['HS256'],
      });

      if (payload.type !== 'apk_access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired APK access token');
    }
  }

  private getApkTokenSecret(): string {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    return `${jwtSecret}_apk`;
  }
}
