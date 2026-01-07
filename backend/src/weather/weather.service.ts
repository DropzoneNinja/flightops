import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { WeatherForecast } from '../database/entities/weather-forecast.entity';
import { WeatherHourly } from '../database/entities/weather-hourly.entity';
import { FlightSite } from '../database/entities/flight-site.entity';

@Injectable()
export class WeatherService {
  constructor(
    @InjectRepository(WeatherForecast)
    private readonly forecastRepository: Repository<WeatherForecast>,
    @InjectRepository(WeatherHourly)
    private readonly hourlyRepository: Repository<WeatherHourly>,
    @InjectRepository(FlightSite)
    private readonly siteRepository: Repository<FlightSite>,
  ) {}

  /**
   * Get forecast data for a site (next 3 days from today)
   * Returns forecast with hourly data included
   */
  async getForecastBySite(siteId: string, userId: string) {
    // Verify the site exists and user has access
    const site = await this.siteRepository.findOne({
      where: { id: siteId, user_id: userId },
    });

    if (!site) {
      throw new NotFoundException('Site not found or access denied');
    }

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get date 3 days from now
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Fetch forecasts for the next 3 days, including hourly data
    const forecasts = await this.forecastRepository.find({
      where: {
        site: { id: siteId },
        forecast_date: Between(today, threeDaysFromNow),
      },
      relations: ['hourly_data'],
      order: {
        forecast_date: 'ASC',
        hourly_data: {
          timestamp: 'ASC',
        },
      },
    });

    return forecasts.map((forecast) => this.formatForecastResponse(forecast));
  }

  /**
   * Get forecast for a specific date
   */
  async getForecastByDate(siteId: string, userId: string, dateString: string) {
    // Verify the site exists and user has access
    const site = await this.siteRepository.findOne({
      where: { id: siteId, user_id: userId },
    });

    if (!site) {
      throw new NotFoundException('Site not found or access denied');
    }

    // Parse the date string (YYYY-MM-DD)
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);

    // Get the next day to create a range
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch the forecast for the specific date
    const forecast = await this.forecastRepository.findOne({
      where: {
        site: { id: siteId },
        forecast_date: Between(date, nextDay),
      },
      relations: ['hourly_data'],
      order: {
        hourly_data: {
          timestamp: 'ASC',
        },
      },
    });

    if (!forecast) {
      return null;
    }

    return this.formatForecastResponse(forecast);
  }

  /**
   * Format forecast response for frontend consumption
   */
  private formatForecastResponse(forecast: WeatherForecast) {
    return {
      id: forecast.id,
      siteId: forecast.site_id,
      date: forecast.forecast_date,
      sunrise: forecast.sunrise,
      sunset: forecast.sunset,
      hourlyData: forecast.hourly_data.map((hourly) => ({
        timestamp: hourly.timestamp,
        temperature: parseFloat(hourly.temperature.toString()),
        windSpeed: parseFloat(hourly.wind_speed.toString()),
        windDirection: parseFloat(hourly.wind_direction.toString()),
        gustSpeed: parseFloat(hourly.gust_speed.toString()),
        gustSpread: parseFloat(hourly.gust_spread.toString()),
        rain: parseFloat(hourly.rain.toString()),
        windScore: hourly.wind_score,
        gustScore: hourly.gust_score,
        gustSpreadScore: hourly.gust_spread_score,
        rainScore: hourly.rain_score,
        overallScore: hourly.overall_score,
      })),
    };
  }
}
