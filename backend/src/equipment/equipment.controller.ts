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
import { CreateReserveDto } from './dto/create-reserve.dto';
import { UpdateReserveDto } from './dto/update-reserve.dto';
import { CreateEngineServiceRecordDto } from './dto/create-engine-service-record.dto';
import { UpdateEngineServiceRecordDto } from './dto/update-engine-service-record.dto';
import { CreateWingInspectionRecordDto } from './dto/create-wing-inspection-record.dto';
import { UpdateWingInspectionRecordDto } from './dto/update-wing-inspection-record.dto';
import { CreateReservePackRecordDto } from './dto/create-reserve-pack-record.dto';
import { UpdateReservePackRecordDto } from './dto/update-reserve-pack-record.dto';
import { CreateReserveInspectionRecordDto } from './dto/create-reserve-inspection-record.dto';
import { UpdateReserveInspectionRecordDto } from './dto/update-reserve-inspection-record.dto';
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

  // ── Reserves ───────────────────────────────────────────────────────────────

  @Get('reserves')
  listReserves(@CurrentUser() user: User) {
    return this.equipmentService.findAllReserves(user.id);
  }

  @Post('reserves')
  createReserve(@CurrentUser() user: User, @Body() dto: CreateReserveDto) {
    return this.equipmentService.createReserve(user.id, dto);
  }

  @Get('reserves/:id')
  getReserve(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.findOneReserve(id, user.id);
  }

  @Put('reserves/:id')
  updateReserve(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateReserveDto,
  ) {
    return this.equipmentService.updateReserve(id, user.id, dto);
  }

  @Delete('reserves/:id')
  async deleteReserve(@CurrentUser() user: User, @Param('id') id: string) {
    await this.equipmentService.removeReserve(id, user.id);
    return { message: 'Reserve deleted' };
  }

  // ── Engine service records ─────────────────────────────────────────────────

  @Get('engines/:id/services')
  listEngineServices(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.listEngineServiceRecords(id, user.id);
  }

  @Post('engines/:id/services')
  createEngineService(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateEngineServiceRecordDto,
  ) {
    return this.equipmentService.createEngineServiceRecord(id, user.id, dto);
  }

  @Put('engines/:id/services/:recordId')
  updateEngineService(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateEngineServiceRecordDto,
  ) {
    return this.equipmentService.updateEngineServiceRecord(id, recordId, user.id, dto);
  }

  @Delete('engines/:id/services/:recordId')
  async deleteEngineService(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
  ) {
    await this.equipmentService.removeEngineServiceRecord(id, recordId, user.id);
    return { message: 'Service record deleted' };
  }

  // ── Wing inspection records ────────────────────────────────────────────────

  @Get('wings/:id/inspections')
  listWingInspections(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.listWingInspectionRecords(id, user.id);
  }

  @Post('wings/:id/inspections')
  createWingInspection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateWingInspectionRecordDto,
  ) {
    return this.equipmentService.createWingInspectionRecord(id, user.id, dto);
  }

  @Put('wings/:id/inspections/:recordId')
  updateWingInspection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateWingInspectionRecordDto,
  ) {
    return this.equipmentService.updateWingInspectionRecord(id, recordId, user.id, dto);
  }

  @Delete('wings/:id/inspections/:recordId')
  async deleteWingInspection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
  ) {
    await this.equipmentService.removeWingInspectionRecord(id, recordId, user.id);
    return { message: 'Inspection record deleted' };
  }

  // ── Reserve pack records ───────────────────────────────────────────────────

  @Get('reserves/:id/packs')
  listReservePacks(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.listReservePackRecords(id, user.id);
  }

  @Post('reserves/:id/packs')
  createReservePack(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateReservePackRecordDto,
  ) {
    return this.equipmentService.createReservePackRecord(id, user.id, dto);
  }

  @Put('reserves/:id/packs/:recordId')
  updateReservePack(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateReservePackRecordDto,
  ) {
    return this.equipmentService.updateReservePackRecord(id, recordId, user.id, dto);
  }

  @Delete('reserves/:id/packs/:recordId')
  async deleteReservePack(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
  ) {
    await this.equipmentService.removeReservePackRecord(id, recordId, user.id);
    return { message: 'Pack record deleted' };
  }

  // ── Reserve inspection records ─────────────────────────────────────────────

  @Get('reserves/:id/inspections')
  listReserveInspections(@CurrentUser() user: User, @Param('id') id: string) {
    return this.equipmentService.listReserveInspectionRecords(id, user.id);
  }

  @Post('reserves/:id/inspections')
  createReserveInspection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateReserveInspectionRecordDto,
  ) {
    return this.equipmentService.createReserveInspectionRecord(id, user.id, dto);
  }

  @Put('reserves/:id/inspections/:recordId')
  updateReserveInspection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateReserveInspectionRecordDto,
  ) {
    return this.equipmentService.updateReserveInspectionRecord(id, recordId, user.id, dto);
  }

  @Delete('reserves/:id/inspections/:recordId')
  async deleteReserveInspection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
  ) {
    await this.equipmentService.removeReserveInspectionRecord(id, recordId, user.id);
    return { message: 'Inspection record deleted' };
  }
}
