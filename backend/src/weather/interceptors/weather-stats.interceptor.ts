import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WeatherStatsService } from '../services/weather-stats.service';

@Injectable()
export class WeatherStatsInterceptor implements NestInterceptor {
  constructor(private readonly weatherStatsService: WeatherStatsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;

    // Only track GET requests to weather endpoints
    if (method === 'GET' && url.includes('/forecast')) {
      // Extract the endpoint pattern
      let endpoint = 'unknown';
      if (url.includes('/multi-height')) {
        endpoint = 'GET /sites/:siteId/forecast/:date/multi-height';
      } else if (url.match(/\/sites\/[^/]+\/forecast\/[\d-]+$/)) {
        endpoint = 'GET /sites/:siteId/forecast/:date';
      } else if (url.match(/\/sites\/[^/]+\/forecast$/)) {
        endpoint = 'GET /sites/:siteId/forecast';
      }

      // Log the API call asynchronously (don't wait for it)
      this.weatherStatsService.updateStats(endpoint, user?.id).catch((error) => {
        // Silently fail - don't block the request
        console.error('Failed to log API call:', error);
      });
    }

    return next.handle().pipe(
      tap(() => {
        // Additional logic after request completion if needed
      }),
    );
  }
}
