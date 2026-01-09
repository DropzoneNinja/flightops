import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherForecast } from '../database/entities/weather-forecast.entity';
import { WeatherHourly } from '../database/entities/weather-hourly.entity';
import { WeatherMultiHeight } from '../database/entities/weather-multi-height.entity';
import { WeatherApiLog } from '../database/entities/weather-api-log.entity';
import { FlightSite } from '../database/entities/flight-site.entity';
import { SettingsModule } from '../settings/settings.module';
import { OpenMeteoService } from './services/open-meteo.service';
import { SunCalculationService } from './services/sun-calculation.service';
import { WeatherScoringService } from './services/weather-scoring.service';
import { WeatherProcessorService } from './services/weather-processor.service';
import { WeatherStatsService } from './services/weather-stats.service';
import { WeatherFetchJob } from './jobs/weather-fetch.job';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeatherForecast,
      WeatherHourly,
      WeatherMultiHeight,
      WeatherApiLog,
      FlightSite,
    ]),
    SettingsModule, // Import settings for threshold access
  ],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    OpenMeteoService,
    SunCalculationService,
    WeatherScoringService,
    WeatherProcessorService,
    WeatherStatsService,
    WeatherFetchJob,
  ],
  exports: [
    WeatherService,
    OpenMeteoService,
    SunCalculationService,
    WeatherScoringService,
    WeatherProcessorService,
    WeatherFetchJob,
  ],
})
export class WeatherModule {}
