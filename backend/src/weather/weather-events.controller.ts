import { Controller, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WeatherEventsService, MessageEvent } from './weather-events.service';

@Controller('weather')
export class WeatherEventsController {
  constructor(private readonly weatherEventsService: WeatherEventsService) {}

  /**
   * SSE endpoint for real-time weather updates
   * GET /weather/events
   */
  @Sse('events')
  @UseGuards(JwtAuthGuard)
  weatherEvents(): Observable<MessageEvent> {
    return this.weatherEventsService.getEventStream();
  }
}
