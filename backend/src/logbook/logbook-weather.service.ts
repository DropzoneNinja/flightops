import { Injectable, Logger } from '@nestjs/common';
import { SitesService } from '../sites/sites.service';
import { WeatherService } from '../weather/weather.service';
import { OpenMeteoService } from '../weather/services/open-meteo.service';
import { WeatherSnapshot, WeatherSource } from '../database/entities/logbook-entry.entity';

@Injectable()
export class LogbookWeatherService {
  private readonly logger = new Logger(LogbookWeatherService.name);

  constructor(
    private readonly sitesService: SitesService,
    private readonly weatherService: WeatherService,
    private readonly openMeteoService: OpenMeteoService,
  ) {}

  /**
   * Capture a frozen weather snapshot for a logbook entry at creation time.
   * Best-effort: never throws; returns null on failure.
   */
  async captureSnapshot(
    takeoffLat: number,
    takeoffLon: number,
    flightDate: string,
    startAt: Date | null,
  ): Promise<WeatherSnapshot | null> {
    try {
      // 1. Site match within 1 km
      const nearSites = await this.sitesService.findNear(takeoffLat, takeoffLon, 1000);
      const matchedSite = nearSites.length > 0 ? nearSites[0] : null;

      const flightDateObj = new Date(`${flightDate}T00:00:00.000Z`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isHistorical = flightDateObj < today;

      let hourlyRows: Array<{
        timestamp: Date | string;
        temperature: number;
        windSpeed: number;
        windDirection: number;
        gustSpeed: number;
        rain: number;
        cloudCover: number | null;
        cloudBase: number | null;
      }> = [];
      let source: WeatherSource = 'none';

      if (matchedSite) {
        // 2a. Try cached forecast (works for near-term/today)
        try {
          const forecast = await this.weatherService.getForecastByDate(
            matchedSite.id,
            'system',
            flightDate,
          );
          if (forecast?.hourlyData?.length) {
            hourlyRows = forecast.hourlyData;
            source = 'forecast_cache';
          }
        } catch {
          // ignore — fall through to archive
        }
      }

      if (hourlyRows.length === 0 && isHistorical) {
        // 2b. Historical archive (Open-Meteo archive API)
        try {
          const archive = await this.openMeteoService.fetchArchive(takeoffLat, takeoffLon, flightDate);
          if (archive?.hourly?.time?.length) {
            hourlyRows = archive.hourly.time.map((t, i) => ({
              timestamp: t,
              temperature: archive.hourly.temperature_2m?.[i] ?? 0,
              windSpeed: archive.hourly.wind_speed_10m?.[i] ?? 0,
              windDirection: archive.hourly.wind_direction_10m?.[i] ?? 0,
              gustSpeed: archive.hourly.wind_gusts_10m?.[i] ?? 0,
              rain: archive.hourly.precipitation?.[i] ?? 0,
              cloudCover: archive.hourly.cloud_cover?.[i] ?? null,
              cloudBase: null,
            }));
            source = 'open_meteo_archive';
          }
        } catch {
          // ignore
        }
      }

      if (hourlyRows.length === 0) {
        // 2c. Forecast by raw coords (future or recent with no cache)
        try {
          const forecast = await this.openMeteoService.fetchForecast(takeoffLat, takeoffLon, 1);
          if (forecast?.hourly?.time?.length) {
            hourlyRows = forecast.hourly.time.map((t, i) => ({
              timestamp: t,
              temperature: forecast.hourly.temperature_2m?.[i] ?? 0,
              windSpeed: forecast.hourly.wind_speed_10m?.[i] ?? 0,
              windDirection: forecast.hourly.wind_direction_10m?.[i] ?? 0,
              gustSpeed: forecast.hourly.wind_gusts_10m?.[i] ?? 0,
              rain: forecast.hourly.precipitation?.[i] ?? 0,
              cloudCover: forecast.hourly.cloud_cover?.[i] ?? null,
              cloudBase: null,
            }));
            source = 'open_meteo_forecast';
          }
        } catch {
          // ignore
        }
      }

      if (hourlyRows.length === 0) {
        return null;
      }

      // 3. Pick the hourly row nearest startAt (or local noon)
      const targetTime = startAt ?? new Date(`${flightDate}T12:00:00.000Z`);
      const nearest = hourlyRows.reduce((best, row) => {
        const rowTime = new Date(row.timestamp).getTime();
        const bestTime = new Date(best.timestamp).getTime();
        return Math.abs(rowTime - targetTime.getTime()) < Math.abs(bestTime - targetTime.getTime())
          ? row
          : best;
      });

      return {
        lat: takeoffLat,
        lon: takeoffLon,
        site_id: matchedSite?.id ?? null,
        matched_site_name: matchedSite?.name ?? null,
        observed_at: new Date(nearest.timestamp).toISOString(),
        takeoff_at: startAt?.toISOString() ?? null,
        temperature_c: nearest.temperature,
        wind_speed_kmh: nearest.windSpeed,
        wind_direction_deg: nearest.windDirection,
        gust_speed_kmh: nearest.gustSpeed,
        precipitation_mm: nearest.rain,
        cloud_cover_pct: nearest.cloudCover,
        cloud_base_m: nearest.cloudBase,
        source,
        raw: nearest,
      };
    } catch (err) {
      this.logger.warn(`Weather snapshot failed for (${takeoffLat},${takeoffLon}): ${err}`);
      return null;
    }
  }
}
