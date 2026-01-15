import { Module } from '@nestjs/common';
import { AirspaceController } from './airspace.controller';
import { AirspaceService } from './airspace.service';

@Module({
  controllers: [AirspaceController],
  providers: [AirspaceService],
  exports: [AirspaceService],
})
export class AirspaceModule {}
