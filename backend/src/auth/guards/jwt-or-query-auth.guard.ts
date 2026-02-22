import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard that accepts token from either:
 * 1. Authorization header (standard)
 * 2. Query parameter 'token' (for image/file URLs)
 */
@Injectable()
export class JwtOrQueryAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Check if token is in query parameter
    const tokenFromQuery = request.query.token;

    if (tokenFromQuery && !request.headers.authorization) {
      // Move token from query to header for passport-jwt to process
      request.headers.authorization = `Bearer ${tokenFromQuery}`;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing authentication token');
    }
    return user;
  }
}
