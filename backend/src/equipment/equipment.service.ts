import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EquipmentEngine } from '../database/entities/equipment-engine.entity';
import { EquipmentWing } from '../database/entities/equipment-wing.entity';
import { EquipmentParamotor } from '../database/entities/equipment-paramotor.entity';
import { EquipmentReserve } from '../database/entities/equipment-reserve.entity';
import { EquipmentParamotorWing } from '../database/entities/equipment-paramotor-wing.entity';
import { EngineServiceRecord } from '../database/entities/equipment-engine-service-record.entity';
import { WingInspectionRecord } from '../database/entities/equipment-wing-inspection-record.entity';
import { ReservePackRecord } from '../database/entities/equipment-reserve-pack-record.entity';
import { ReserveInspectionRecord } from '../database/entities/equipment-reserve-inspection-record.entity';
import { EquipmentHoursService } from './equipment-hours.service';
import { CreateEngineDto } from './dto/create-engine.dto';
import { UpdateEngineDto } from './dto/update-engine.dto';
import { CreateWingDto } from './dto/create-wing.dto';
import { UpdateWingDto } from './dto/update-wing.dto';
import { CreateParamotorDto } from './dto/create-paramotor.dto';
import { UpdateParamotorDto } from './dto/update-paramotor.dto';
import { CreateReserveDto } from './dto/create-reserve.dto';
import { UpdateReserveDto } from './dto/update-reserve.dto';
import { ParamotorWingLinkDto } from './dto/paramotor-wing-link.dto';
import { CreateEngineServiceRecordDto } from './dto/create-engine-service-record.dto';
import { UpdateEngineServiceRecordDto } from './dto/update-engine-service-record.dto';
import { CreateWingInspectionRecordDto } from './dto/create-wing-inspection-record.dto';
import { UpdateWingInspectionRecordDto } from './dto/update-wing-inspection-record.dto';
import { CreateReservePackRecordDto } from './dto/create-reserve-pack-record.dto';
import { UpdateReservePackRecordDto } from './dto/update-reserve-pack-record.dto';
import { CreateReserveInspectionRecordDto } from './dto/create-reserve-inspection-record.dto';
import { UpdateReserveInspectionRecordDto } from './dto/update-reserve-inspection-record.dto';

const PARAMOTOR_RELATIONS = ['engine', 'reserve', 'wing_links', 'wing_links.wing'];

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(EquipmentEngine)
    private readonly engineRepo: Repository<EquipmentEngine>,
    @InjectRepository(EquipmentWing)
    private readonly wingRepo: Repository<EquipmentWing>,
    @InjectRepository(EquipmentParamotor)
    private readonly paramotorRepo: Repository<EquipmentParamotor>,
    @InjectRepository(EquipmentReserve)
    private readonly reserveRepo: Repository<EquipmentReserve>,
    @InjectRepository(EquipmentParamotorWing)
    private readonly paramotorWingRepo: Repository<EquipmentParamotorWing>,
    @InjectRepository(EngineServiceRecord)
    private readonly engineServiceRepo: Repository<EngineServiceRecord>,
    @InjectRepository(WingInspectionRecord)
    private readonly wingInspectionRepo: Repository<WingInspectionRecord>,
    @InjectRepository(ReservePackRecord)
    private readonly reservePackRepo: Repository<ReservePackRecord>,
    @InjectRepository(ReserveInspectionRecord)
    private readonly reserveInspectionRepo: Repository<ReserveInspectionRecord>,
    private readonly hoursService: EquipmentHoursService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Engines ────────────────────────────────────────────────────────────────

  async createEngine(userId: string, dto: CreateEngineDto): Promise<EquipmentEngine> {
    const engine = this.engineRepo.create({ ...dto, user_id: userId });
    return this.engineRepo.save(engine);
  }

  async findAllEngines(userId: string): Promise<EquipmentEngine[]> {
    return this.engineRepo.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });
  }

  async findOneEngine(id: string, userId: string): Promise<EquipmentEngine> {
    const engine = await this.engineRepo.findOne({ where: { id, user_id: userId } });
    if (!engine) throw new NotFoundException('Engine not found');
    return engine;
  }

  async updateEngine(id: string, userId: string, dto: UpdateEngineDto): Promise<EquipmentEngine> {
    const engine = await this.findOneEngine(id, userId);
    Object.assign(engine, dto);
    return this.engineRepo.save(engine);
  }

  async removeEngine(id: string, userId: string): Promise<void> {
    const engine = await this.findOneEngine(id, userId);
    await this.engineRepo.remove(engine);
  }

  // ── Wings ──────────────────────────────────────────────────────────────────

  async createWing(userId: string, dto: CreateWingDto): Promise<EquipmentWing> {
    const wing = this.wingRepo.create({ ...dto, user_id: userId });
    return this.wingRepo.save(wing);
  }

  async findAllWings(userId: string): Promise<EquipmentWing[]> {
    return this.wingRepo.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });
  }

  async findOneWing(id: string, userId: string): Promise<EquipmentWing> {
    const wing = await this.wingRepo.findOne({ where: { id, user_id: userId } });
    if (!wing) throw new NotFoundException('Wing not found');
    return wing;
  }

  async updateWing(id: string, userId: string, dto: UpdateWingDto): Promise<EquipmentWing> {
    const wing = await this.findOneWing(id, userId);
    Object.assign(wing, dto);
    return this.wingRepo.save(wing);
  }

  async removeWing(id: string, userId: string): Promise<void> {
    const wing = await this.findOneWing(id, userId);
    await this.wingRepo.remove(wing);
  }

  // ── Reserves ───────────────────────────────────────────────────────────────

  async createReserve(userId: string, dto: CreateReserveDto): Promise<EquipmentReserve> {
    const reserve = this.reserveRepo.create({ ...dto, user_id: userId });
    return this.reserveRepo.save(reserve);
  }

  async findAllReserves(userId: string): Promise<EquipmentReserve[]> {
    return this.reserveRepo.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });
  }

  async findOneReserve(id: string, userId: string): Promise<EquipmentReserve> {
    const reserve = await this.reserveRepo.findOne({ where: { id, user_id: userId } });
    if (!reserve) throw new NotFoundException('Reserve not found');
    return reserve;
  }

  async updateReserve(id: string, userId: string, dto: UpdateReserveDto): Promise<EquipmentReserve> {
    const reserve = await this.findOneReserve(id, userId);
    Object.assign(reserve, dto);
    return this.reserveRepo.save(reserve);
  }

  async removeReserve(id: string, userId: string): Promise<void> {
    const reserve = await this.findOneReserve(id, userId);
    // Paramotor reserve_id FK is ON DELETE SET NULL; records cascade
    await this.reserveRepo.remove(reserve);
  }

  // ── Paramotors ─────────────────────────────────────────────────────────────

  async createParamotor(userId: string, dto: CreateParamotorDto): Promise<EquipmentParamotor> {
    const { wings, ...rest } = dto;
    await this.validateParamotorRefs(userId, rest.engine_id, rest.reserve_id, wings);

    const saved = await this.dataSource.transaction(async (em) => {
      const paramotor = em
        .getRepository(EquipmentParamotor)
        .create({ ...rest, user_id: userId });
      const savedParamotor = await em.getRepository(EquipmentParamotor).save(paramotor);
      if (wings?.length) {
        await em.getRepository(EquipmentParamotorWing).save(
          wings.map((w) =>
            em.getRepository(EquipmentParamotorWing).create({
              paramotor_id: savedParamotor.id,
              wing_id: w.wing_id,
              fuel_burn_lph: w.fuel_burn_lph ?? null,
            }),
          ),
        );
      }
      return savedParamotor;
    });

    return this.findOneParamotor(saved.id, userId);
  }

  async findAllParamotors(userId: string): Promise<EquipmentParamotor[]> {
    return this.paramotorRepo.find({
      where: { user_id: userId },
      relations: PARAMOTOR_RELATIONS,
      order: { name: 'ASC' },
    });
  }

  async findOneParamotor(id: string, userId: string): Promise<EquipmentParamotor> {
    const paramotor = await this.paramotorRepo.findOne({
      where: { id, user_id: userId },
      relations: PARAMOTOR_RELATIONS,
    });
    if (!paramotor) throw new NotFoundException('Paramotor not found');
    return paramotor;
  }

  async updateParamotor(
    id: string,
    userId: string,
    dto: UpdateParamotorDto,
  ): Promise<EquipmentParamotor> {
    const paramotor = await this.findOneParamotor(id, userId);
    const { wings, ...rest } = dto;
    await this.validateParamotorRefs(
      userId,
      rest.engine_id ?? undefined,
      rest.reserve_id ?? undefined,
      wings,
    );

    const oldEngineId = paramotor.engine_id;
    const oldReserveId = paramotor.reserve_id;

    await this.dataSource.transaction(async (em) => {
      Object.assign(paramotor, rest);
      // Clear stale eager relation objects so the changed FK column wins on save
      if (rest.engine_id !== undefined) paramotor.engine = null;
      if (rest.reserve_id !== undefined) paramotor.reserve = null;
      delete (paramotor as Partial<EquipmentParamotor>).wing_links;
      await em.getRepository(EquipmentParamotor).save(paramotor);

      if (wings !== undefined) {
        // Full replace: drop existing links, insert the new set
        await em.getRepository(EquipmentParamotorWing).delete({ paramotor_id: id });
        if (wings.length) {
          await em.getRepository(EquipmentParamotorWing).save(
            wings.map((w) =>
              em.getRepository(EquipmentParamotorWing).create({
                paramotor_id: id,
                wing_id: w.wing_id,
                fuel_burn_lph: w.fuel_burn_lph ?? null,
              }),
            ),
          );
        }
      }
    });

    // Re-pointing a paramotor moves its hours to the new engine/reserve
    const engineIds = new Set<string>();
    const reserveIds = new Set<string>();
    if (rest.engine_id !== undefined && rest.engine_id !== oldEngineId) {
      if (oldEngineId) engineIds.add(oldEngineId);
      if (rest.engine_id) engineIds.add(rest.engine_id);
    }
    if (rest.reserve_id !== undefined && rest.reserve_id !== oldReserveId) {
      if (oldReserveId) reserveIds.add(oldReserveId);
      if (rest.reserve_id) reserveIds.add(rest.reserve_id);
    }
    if (engineIds.size || reserveIds.size) {
      await this.hoursService.recalculate({ engineIds, reserveIds });
    }

    return this.findOneParamotor(id, userId);
  }

  async removeParamotor(id: string, userId: string): Promise<void> {
    const paramotor = await this.findOneParamotor(id, userId);
    const { engine_id, reserve_id } = paramotor;
    await this.paramotorRepo.remove(paramotor);
    await this.hoursService.recalculate({
      engineIds: engine_id ? [engine_id] : [],
      reserveIds: reserve_id ? [reserve_id] : [],
    });
  }

  private async validateParamotorRefs(
    userId: string,
    engineId?: string | null,
    reserveId?: string | null,
    wings?: ParamotorWingLinkDto[],
  ): Promise<void> {
    if (engineId) await this.findOneEngine(engineId, userId);
    if (reserveId) await this.findOneReserve(reserveId, userId);
    if (wings?.length) {
      const wingIds = wings.map((w) => w.wing_id);
      if (new Set(wingIds).size !== wingIds.length) {
        throw new BadRequestException('Duplicate wing_id in wings');
      }
      for (const wingId of wingIds) {
        await this.findOneWing(wingId, userId);
      }
    }
  }

  // ── Engine service records ─────────────────────────────────────────────────

  async listEngineServiceRecords(
    engineId: string,
    userId: string,
  ): Promise<EngineServiceRecord[]> {
    await this.findOneEngine(engineId, userId);
    return this.engineServiceRepo.find({
      where: { engine_id: engineId },
      order: { service_date: 'DESC' },
    });
  }

  async createEngineServiceRecord(
    engineId: string,
    userId: string,
    dto: CreateEngineServiceRecordDto,
  ): Promise<EngineServiceRecord> {
    await this.findOneEngine(engineId, userId);
    const record = this.engineServiceRepo.create({ ...dto, engine_id: engineId });
    return this.engineServiceRepo.save(record);
  }

  async updateEngineServiceRecord(
    engineId: string,
    recordId: string,
    userId: string,
    dto: UpdateEngineServiceRecordDto,
  ): Promise<EngineServiceRecord> {
    await this.findOneEngine(engineId, userId);
    const record = await this.engineServiceRepo.findOne({
      where: { id: recordId, engine_id: engineId },
    });
    if (!record) throw new NotFoundException('Service record not found');
    Object.assign(record, dto);
    return this.engineServiceRepo.save(record);
  }

  async removeEngineServiceRecord(
    engineId: string,
    recordId: string,
    userId: string,
  ): Promise<void> {
    await this.findOneEngine(engineId, userId);
    const record = await this.engineServiceRepo.findOne({
      where: { id: recordId, engine_id: engineId },
    });
    if (!record) throw new NotFoundException('Service record not found');
    await this.engineServiceRepo.remove(record);
  }

  // ── Wing inspection records ────────────────────────────────────────────────

  async listWingInspectionRecords(
    wingId: string,
    userId: string,
  ): Promise<WingInspectionRecord[]> {
    await this.findOneWing(wingId, userId);
    return this.wingInspectionRepo.find({
      where: { wing_id: wingId },
      order: { inspection_date: 'DESC' },
    });
  }

  async createWingInspectionRecord(
    wingId: string,
    userId: string,
    dto: CreateWingInspectionRecordDto,
  ): Promise<WingInspectionRecord> {
    await this.findOneWing(wingId, userId);
    const record = this.wingInspectionRepo.create({ ...dto, wing_id: wingId });
    return this.wingInspectionRepo.save(record);
  }

  async updateWingInspectionRecord(
    wingId: string,
    recordId: string,
    userId: string,
    dto: UpdateWingInspectionRecordDto,
  ): Promise<WingInspectionRecord> {
    await this.findOneWing(wingId, userId);
    const record = await this.wingInspectionRepo.findOne({
      where: { id: recordId, wing_id: wingId },
    });
    if (!record) throw new NotFoundException('Inspection record not found');
    Object.assign(record, dto);
    return this.wingInspectionRepo.save(record);
  }

  async removeWingInspectionRecord(
    wingId: string,
    recordId: string,
    userId: string,
  ): Promise<void> {
    await this.findOneWing(wingId, userId);
    const record = await this.wingInspectionRepo.findOne({
      where: { id: recordId, wing_id: wingId },
    });
    if (!record) throw new NotFoundException('Inspection record not found');
    await this.wingInspectionRepo.remove(record);
  }

  // ── Reserve pack records ───────────────────────────────────────────────────

  async listReservePackRecords(
    reserveId: string,
    userId: string,
  ): Promise<ReservePackRecord[]> {
    await this.findOneReserve(reserveId, userId);
    return this.reservePackRepo.find({
      where: { reserve_id: reserveId },
      order: { pack_date: 'DESC' },
    });
  }

  async createReservePackRecord(
    reserveId: string,
    userId: string,
    dto: CreateReservePackRecordDto,
  ): Promise<ReservePackRecord> {
    await this.findOneReserve(reserveId, userId);
    const record = this.reservePackRepo.create({ ...dto, reserve_id: reserveId });
    return this.reservePackRepo.save(record);
  }

  async updateReservePackRecord(
    reserveId: string,
    recordId: string,
    userId: string,
    dto: UpdateReservePackRecordDto,
  ): Promise<ReservePackRecord> {
    await this.findOneReserve(reserveId, userId);
    const record = await this.reservePackRepo.findOne({
      where: { id: recordId, reserve_id: reserveId },
    });
    if (!record) throw new NotFoundException('Pack record not found');
    Object.assign(record, dto);
    return this.reservePackRepo.save(record);
  }

  async removeReservePackRecord(
    reserveId: string,
    recordId: string,
    userId: string,
  ): Promise<void> {
    await this.findOneReserve(reserveId, userId);
    const record = await this.reservePackRepo.findOne({
      where: { id: recordId, reserve_id: reserveId },
    });
    if (!record) throw new NotFoundException('Pack record not found');
    await this.reservePackRepo.remove(record);
  }

  // ── Reserve inspection records ─────────────────────────────────────────────

  async listReserveInspectionRecords(
    reserveId: string,
    userId: string,
  ): Promise<ReserveInspectionRecord[]> {
    await this.findOneReserve(reserveId, userId);
    return this.reserveInspectionRepo.find({
      where: { reserve_id: reserveId },
      order: { inspection_date: 'DESC' },
    });
  }

  async createReserveInspectionRecord(
    reserveId: string,
    userId: string,
    dto: CreateReserveInspectionRecordDto,
  ): Promise<ReserveInspectionRecord> {
    await this.findOneReserve(reserveId, userId);
    const record = this.reserveInspectionRepo.create({ ...dto, reserve_id: reserveId });
    return this.reserveInspectionRepo.save(record);
  }

  async updateReserveInspectionRecord(
    reserveId: string,
    recordId: string,
    userId: string,
    dto: UpdateReserveInspectionRecordDto,
  ): Promise<ReserveInspectionRecord> {
    await this.findOneReserve(reserveId, userId);
    const record = await this.reserveInspectionRepo.findOne({
      where: { id: recordId, reserve_id: reserveId },
    });
    if (!record) throw new NotFoundException('Inspection record not found');
    Object.assign(record, dto);
    return this.reserveInspectionRepo.save(record);
  }

  async removeReserveInspectionRecord(
    reserveId: string,
    recordId: string,
    userId: string,
  ): Promise<void> {
    await this.findOneReserve(reserveId, userId);
    const record = await this.reserveInspectionRepo.findOne({
      where: { id: recordId, reserve_id: reserveId },
    });
    if (!record) throw new NotFoundException('Inspection record not found');
    await this.reserveInspectionRepo.remove(record);
  }
}
