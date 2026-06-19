import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pilot } from '../database/entities/pilot.entity';
import { OpenSkyApiStatsDaily } from '../database/entities/opensky-api-stats-daily.entity';
import { OpenSkyApiStatsHourly } from '../database/entities/opensky-api-stats-hourly.entity';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { OpenSkyService } from './opensky.service';
import { OpenSkyStatsService } from './opensky-stats.service';
import { OpenSkyController } from './opensky.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pilot, OpenSkyApiStatsDaily, OpenSkyApiStatsHourly]),
    SettingsModule,
    AuthModule,
  ],
  controllers: [OpenSkyController],
  providers: [OpenSkyService, OpenSkyStatsService],
  exports: [OpenSkyService],
})
export class OpenSkyModule {}
