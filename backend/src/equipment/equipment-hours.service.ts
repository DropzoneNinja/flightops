import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentEngine } from '../database/entities/equipment-engine.entity';
import { EquipmentWing } from '../database/entities/equipment-wing.entity';
import { EquipmentParamotor } from '../database/entities/equipment-paramotor.entity';
import { EquipmentReserve } from '../database/entities/equipment-reserve.entity';
import { LogbookEntry } from '../database/entities/logbook-entry.entity';

export interface HoursRecalcTargets {
  wingIds?: Iterable<string>;
  paramotorIds?: Iterable<string>;
  engineIds?: Iterable<string>;
  reserveIds?: Iterable<string>;
}

/**
 * Recomputes equipment total_hours from logbook entries. Wings and paramotors
 * are summed directly from entries referencing them; engine and reserve hours
 * are the aggregate of all paramotors currently linked to them (history-free:
 * re-pointing a paramotor moves its hours to the new engine/reserve).
 */
@Injectable()
export class EquipmentHoursService {
  constructor(
    @InjectRepository(EquipmentEngine)
    private readonly engineRepo: Repository<EquipmentEngine>,
    @InjectRepository(EquipmentWing)
    private readonly wingRepo: Repository<EquipmentWing>,
    @InjectRepository(EquipmentParamotor)
    private readonly paramotorRepo: Repository<EquipmentParamotor>,
    @InjectRepository(EquipmentReserve)
    private readonly reserveRepo: Repository<EquipmentReserve>,
    @InjectRepository(LogbookEntry)
    private readonly logbookRepo: Repository<LogbookEntry>,
  ) {}

  async recalculate(targets: HoursRecalcTargets, pilotId?: string): Promise<void> {
    const wingIds = new Set(targets.wingIds ?? []);
    const paramotorIds = new Set(targets.paramotorIds ?? []);
    const engineIds = new Set(targets.engineIds ?? []);
    const reserveIds = new Set(targets.reserveIds ?? []);

    for (const wingId of wingIds) {
      const hours = await this.sumEntryHours('wing_id', wingId, pilotId);
      await this.wingRepo.update(wingId, { total_hours: hours });
    }

    for (const paramotorId of paramotorIds) {
      const hours = await this.sumEntryHours('paramotor_id', paramotorId, pilotId);
      await this.paramotorRepo.update(paramotorId, { total_hours: hours });

      const pm = await this.paramotorRepo.findOne({ where: { id: paramotorId } });
      if (pm?.engine_id) engineIds.add(pm.engine_id);
      if (pm?.reserve_id) reserveIds.add(pm.reserve_id);
    }

    for (const engineId of engineIds) {
      const hours = await this.sumParamotorHours({ engine_id: engineId }, pilotId);
      await this.engineRepo.update(engineId, { total_hours: hours });
    }

    for (const reserveId of reserveIds) {
      const hours = await this.sumParamotorHours({ reserve_id: reserveId }, pilotId);
      await this.reserveRepo.update(reserveId, { total_hours: hours });
    }
  }

  private async sumEntryHours(
    column: 'wing_id' | 'paramotor_id',
    equipmentId: string,
    pilotId?: string,
  ): Promise<number> {
    const qb = this.logbookRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.duration_seconds), 0)', 'total')
      .where(`e.${column} = :equipmentId`, { equipmentId })
      .andWhere('e.deleted_at IS NULL');
    if (pilotId) qb.andWhere('e.pilot_id = :pilotId', { pilotId });
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0) / 3600;
  }

  private async sumParamotorHours(
    where: { engine_id: string } | { reserve_id: string },
    pilotId?: string,
  ): Promise<number> {
    const paramotors = await this.paramotorRepo.find({ where });
    let hours = 0;
    for (const pm of paramotors) {
      hours += await this.sumEntryHours('paramotor_id', pm.id, pilotId);
    }
    return hours;
  }
}
