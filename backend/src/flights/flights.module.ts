import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from '../database/entities/flight.entity';
import { FlightEvent } from '../database/entities/flight-event.entity';
import { FlightScore } from '../database/entities/flight-score.entity';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { FlightAnalysisService } from './flight-analysis.service';
import { GpxParserService } from './gpx-parser.service';
import { GpxNormalizerService } from './gpx-normalizer.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PilotsModule } from '../pilots/pilots.module';
import { LogbookModule } from '../logbook/logbook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flight, FlightEvent, FlightScore]),
    AuthModule,
    UsersModule,
    PilotsModule,
    forwardRef(() => LogbookModule),
  ],
  controllers: [FlightsController],
  providers: [FlightsService, FlightAnalysisService, GpxParserService, GpxNormalizerService],
  exports: [FlightsService],
})
export class FlightsModule {}
