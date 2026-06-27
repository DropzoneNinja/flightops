import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentEngine } from '../database/entities/equipment-engine.entity';
import { EquipmentWing } from '../database/entities/equipment-wing.entity';
import { EquipmentParamotor } from '../database/entities/equipment-paramotor.entity';
import { CreateEngineDto } from './dto/create-engine.dto';
import { UpdateEngineDto } from './dto/update-engine.dto';
import { CreateWingDto } from './dto/create-wing.dto';
import { UpdateWingDto } from './dto/update-wing.dto';
import { CreateParamotorDto } from './dto/create-paramotor.dto';
import { UpdateParamotorDto } from './dto/update-paramotor.dto';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(EquipmentEngine)
    private readonly engineRepo: Repository<EquipmentEngine>,
    @InjectRepository(EquipmentWing)
    private readonly wingRepo: Repository<EquipmentWing>,
    @InjectRepository(EquipmentParamotor)
    private readonly paramotorRepo: Repository<EquipmentParamotor>,
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

  // ── Paramotors ─────────────────────────────────────────────────────────────

  async createParamotor(userId: string, dto: CreateParamotorDto): Promise<EquipmentParamotor> {
    const paramotor = this.paramotorRepo.create({ ...dto, user_id: userId });
    return this.paramotorRepo.save(paramotor);
  }

  async findAllParamotors(userId: string): Promise<EquipmentParamotor[]> {
    return this.paramotorRepo.find({
      where: { user_id: userId },
      relations: ['engine'],
      order: { name: 'ASC' },
    });
  }

  async findOneParamotor(id: string, userId: string): Promise<EquipmentParamotor> {
    const paramotor = await this.paramotorRepo.findOne({
      where: { id, user_id: userId },
      relations: ['engine'],
    });
    if (!paramotor) throw new NotFoundException('Paramotor not found');
    return paramotor;
  }

  async updateParamotor(id: string, userId: string, dto: UpdateParamotorDto): Promise<EquipmentParamotor> {
    const paramotor = await this.findOneParamotor(id, userId);
    Object.assign(paramotor, dto);
    return this.paramotorRepo.save(paramotor);
  }

  async removeParamotor(id: string, userId: string): Promise<void> {
    const paramotor = await this.findOneParamotor(id, userId);
    await this.paramotorRepo.remove(paramotor);
  }
}
