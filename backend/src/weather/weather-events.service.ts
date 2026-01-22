import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface WeatherUpdateEvent {
  siteId: string;
  timestamp: Date;
}

export interface MessageEvent {
  data: string;
  type?: string;
}

@Injectable()
export class WeatherEventsService {
  private eventSubject = new Subject<WeatherUpdateEvent>();

  /**
   * Emit weather update event when data is refreshed
   */
  emitWeatherUpdate(siteId: string): void {
    this.eventSubject.next({
      siteId,
      timestamp: new Date(),
    });
  }

  /**
   * Get observable stream of weather events for SSE
   */
  getEventStream(): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: 'weather-update',
      })),
    );
  }
}
