import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherForecast } from '../database/entities/weather-forecast.entity';
import { WeatherHourly } from '../database/entities/weather-hourly.entity';
import { FlightSite } from '../database/entities/flight-site.entity';
import { SettingsModule } from '../settings/settings.module';
import { OpenMeteoService } from './services/open-meteo.service';
import { SunCalculationService } from './services/sun-calculation.service';
import { WeatherScoringService } from './services/weather-scoring.service';
import { WeatherProcessorService } from './services/weather-processor.service';
import { WeatherFetchJob } from './jobs/weather-fetch.job';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherForecast, WeatherHourly, FlightSite]),
    SettingsModule, // Import settings for threshold access
  ],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    OpenMeteoService,
    SunCalculationService,
    WeatherScoringService,
    WeatherProcessorService,
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
