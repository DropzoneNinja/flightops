import { Controller, Get, UseGuards } from '@nestjs/common';
import { AirspaceService } from './airspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('airspace')
@UseGuards(JwtAuthGuard)
export class AirspaceController {
  constructor(private readonly airspaceService: AirspaceService) {}

  /**
   * GET /airspace
   * Get all airspace features as GeoJSON
   */
  @Get()
  getAirspace() {
    return this.airspaceService.getAirspace();
  }

  /**
   * GET /airspace/classes
   * Get available airspace classes
   */
  @Get('classes')
  getClasses() {
    return this.airspaceService.getClasses();
  }
}
