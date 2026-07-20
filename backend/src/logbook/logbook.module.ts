import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogbookEntry } from '../database/entities/logbook-entry.entity';
import { LogbookBaseline } from '../database/entities/logbook-baseline.entity';
import { Flight } from '../database/entities/flight.entity';
import { Media } from '../database/entities/media.entity';
import { EquipmentWing } from '../database/entities/equipment-wing.entity';
import { EquipmentParamotor } from '../database/entities/equipment-paramotor.entity';
import { LogbookController } from './logbook.controller';
import { LogbookService } from './logbook.service';
import { LogbookWeatherService } from './logbook-weather.service';
import { LogbookMediaService } from './logbook-media.service';
import { LogbookPdfService } from './logbook-pdf.service';
import { AuthModule } from '../auth/auth.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { PilotsModule } from '../pilots/pilots.module';
import { WeatherModule } from '../weather/weather.module';
import { SitesModule } from '../sites/sites.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LogbookEntry, LogbookBaseline, Flight, Media, EquipmentWing, EquipmentParamotor]),
    AuthModule,
    EquipmentModule,
    PilotsModule,
    WeatherModule,
    SitesModule,
  ],
  controllers: [LogbookController],
  providers: [LogbookService, LogbookWeatherService, LogbookMediaService, LogbookPdfService],
  exports: [LogbookService],
})
export class LogbookModule {}
