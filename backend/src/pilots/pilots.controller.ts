import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PilotsService } from './pilots.service';
import { CreatePilotDto } from './dto/create-pilot.dto';
import { UpdatePilotDto } from './dto/update-pilot.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('pilots')
@UseGuards(JwtAuthGuard)
export class PilotsController {
  constructor(private readonly pilotsService: PilotsService) {}

  /** GET /pilots — list all pilots */
  @Get()
  findAll() {
    return this.pilotsService.findAll();
  }

  /** GET /pilots/positions — all pilot live positions (must be before :id route) */
  @Get('positions')
  getAllPositions() {
    return this.pilotsService.getAllPositions();
  }

  /** PUT /pilots/me/position — push current pilot position */
  @Put('me/position')
  updatePosition(@CurrentUser() user: User, @Body() dto: UpdatePositionDto) {
    return this.pilotsService.updatePosition(user.id, dto);
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

  /** POST /pilots — create pilot (admin only) */
  @Post()
  create(@Body() dto: CreatePilotDto, @CurrentUser() user: User) {
    return this.pilotsService.create(dto, user);
  }

  /** PATCH /pilots/:id — update pilot (own profile or admin) */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePilotDto, @CurrentUser() user: User) {
    return this.pilotsService.update(id, dto, user);
  }

  /** DELETE /pilots/:id — delete pilot (own profile or admin) */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.pilotsService.delete(id, user);
  }
}
