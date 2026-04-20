import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { Mission } from '../database/entities/mission.entity';
import { MissionWaypoint } from '../database/entities/mission-waypoint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mission, MissionWaypoint])],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
