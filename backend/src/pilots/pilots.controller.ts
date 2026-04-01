import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PilotsService } from './pilots.service';
import { CreatePilotDto } from './dto/create-pilot.dto';
import { UpdatePilotDto } from './dto/update-pilot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pilots')
@UseGuards(JwtAuthGuard)
export class PilotsController {
  constructor(private readonly pilotsService: PilotsService) {}

  /** GET /pilots — list all pilots */
  @Get()
  findAll() {
    return this.pilotsService.findAll();
  }

  /** GET /pilots/:id — pilot detail */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pilotsService.findById(id);
  }

  /** GET /pilots/:id/performance — recent flights, score trends, personal bests */
  @Get(':id/performance')
  getPerformance(@Param('id') id: string) {
    return this.pilotsService.getPerformance(id);
  }

  /** POST /pilots — create pilot */
  @Post()
  create(@Body() dto: CreatePilotDto) {
    return this.pilotsService.create(dto);
  }

  /** PATCH /pilots/:id — update pilot */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePilotDto) {
    return this.pilotsService.update(id, dto);
  }

  /** DELETE /pilots/:id — delete pilot */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pilotsService.delete(id);
  }
}
