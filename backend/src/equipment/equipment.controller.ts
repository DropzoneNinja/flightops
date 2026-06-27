import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { CreateEngineDto } from './dto/create-engine.dto';
import { UpdateEngineDto } from './dto/update-engine.dto';
import { CreateWingDto } from './dto/create-wing.dto';
import { UpdateWingDto } from './dto/update-wing.dto';
import { CreateParamotorDto } from './dto/create-paramotor.dto';
import { UpdateParamotorDto } from './dto/update-paramotor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // ── Engines ────────────────────────────────────────────────────────────────

  @Get('engines')
  listEngines(@CurrentUser() user: User) {
    return this.equipmentService.findAllEngines(user.id);
  }

  @Post('engines')
  createEngine(@CurrentUser() user: User, @Body() dto: CreateEngineDto) {
    return this.equipmentService.createEngine(user.id, dto);
  }

  @Get('engines/:id')
  getEngine(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.findOneEngine(id, user.id);
  }

  @Put('engines/:id')
  updateEngine(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateEngineDto,
  ) {
    return this.equipmentService.updateEngine(id, user.id, dto);
  }

  @Delete('engines/:id')
  async deleteEngine(@CurrentUser() user: User, @Param('id') id: string) {
    await this.equipmentService.removeEngine(id, user.id);
    return { message: 'Engine deleted' };
  }

  // ── Wings ──────────────────────────────────────────────────────────────────

  @Get('wings')
  listWings(@CurrentUser() user: User) {
    return this.equipmentService.findAllWings(user.id);
  }

  @Post('wings')
  createWing(@CurrentUser() user: User, @Body() dto: CreateWingDto) {
    return this.equipmentService.createWing(user.id, dto);
  }

  @Get('wings/:id')
  getWing(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.findOneWing(id, user.id);
  }

  @Put('wings/:id')
  updateWing(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateWingDto,
  ) {
    return this.equipmentService.updateWing(id, user.id, dto);
  }

  @Delete('wings/:id')
  async deleteWing(@CurrentUser() user: User, @Param('id') id: string) {
    await this.equipmentService.removeWing(id, user.id);
    return { message: 'Wing deleted' };
  }

  // ── Paramotors ─────────────────────────────────────────────────────────────

  @Get('paramotors')
  listParamotors(@CurrentUser() user: User) {
    return this.equipmentService.findAllParamotors(user.id);
  }

  @Post('paramotors')
  createParamotor(@CurrentUser() user: User, @Body() dto: CreateParamotorDto) {
    return this.equipmentService.createParamotor(user.id, dto);
  }

  @Get('paramotors/:id')
  getParamotor(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.findOneParamotor(id, user.id);
  }

  @Put('paramotors/:id')
  updateParamotor(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateParamotorDto,
  ) {
    return this.equipmentService.updateParamotor(id, user.id, dto);
  }

  @Delete('paramotors/:id')
  async deleteParamotor(@CurrentUser() user: User, @Param('id') id: string) {
    await this.equipmentService.removeParamotor(id, user.id);
    return { message: 'Paramotor deleted' };
  }
}
