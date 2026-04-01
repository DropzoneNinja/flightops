import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pilot } from '../database/entities/pilot.entity';
import { Flight } from '../database/entities/flight.entity';
import { FlightScore } from '../database/entities/flight-score.entity';
import { PilotsController } from './pilots.controller';
import { PilotsService } from './pilots.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pilot, Flight, FlightScore]), AuthModule],
  controllers: [PilotsController],
  providers: [PilotsService],
  exports: [PilotsService],
})
export class PilotsModule {}
