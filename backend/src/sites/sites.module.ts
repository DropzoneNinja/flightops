import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { FlightSite } from '../database/entities/flight-site.entity';
import { GeocodingService } from './services/geocoding.service';

@Module({
  imports: [TypeOrmModule.forFeature([FlightSite])],
  controllers: [SitesController],
  providers: [SitesService, GeocodingService],
  exports: [SitesService], // Export for use in other modules (e.g., WeatherModule)
})
export class SitesModule {}
