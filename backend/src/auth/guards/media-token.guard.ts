import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { MediaTokenService } from '../media-token.service';

/**
 * Guard for validating media access tokens
 * Tokens must be provided in the 'token' query parameter
 * Validates that the token grants access to the specific media file being requested
 */
@Injectable()
export class MediaTokenGuard implements CanActivate {
  constructor(private readonly mediaTokenService: MediaTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get token from query parameter
    const token = request.query.token;

    if (!token) {
      throw new UnauthorizedException(
        'Media access token required. Please request a token from /media/:id/token endpoint.',
      );
    }

    try {
      // Validate the token
      const payload = await this.mediaTokenService.validateMediaToken(token);

      // Get the requested media ID from the route parameter
      const requestedMediaId = request.params.id;

      // Verify the token grants access to this specific media file
      if (payload.mediaId !== requestedMediaId) {
        throw new UnauthorizedException(
          'Token does not grant access to this media file',
        );
      }

      // Attach user info to request (similar to JWT guard)
      request.user = {
        id: payload.userId,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        error.message || 'Invalid or expired media access token',
      );
    }
  }
}
