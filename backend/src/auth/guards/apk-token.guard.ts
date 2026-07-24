import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApkTokenService } from '../apk-token.service';

/**
 * Validates the short-lived download token issued by GET /apk-releases/:id/token.
 * Modeled on MediaTokenGuard.
 */
@Injectable()
export class ApkTokenGuard implements CanActivate {
  constructor(private readonly apkTokenService: ApkTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.query.token;

    if (!token) {
      throw new UnauthorizedException(
        'APK access token required. Please request a token from /apk-releases/:id/token endpoint.',
      );
    }

    try {
      const payload = await this.apkTokenService.validateApkToken(token);
      const requestedReleaseId = request.params.id;

      if (payload.releaseId !== requestedReleaseId) {
        throw new UnauthorizedException(
          'Token does not grant access to this APK release',
        );
      }

      request.user = { id: payload.userId };
      return true;
    } catch (error) {
      throw new UnauthorizedException(
        error.message || 'Invalid or expired APK access token',
      );
    }
  }
}
