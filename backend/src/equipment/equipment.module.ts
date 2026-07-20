import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEngine } from '../database/entities/equipment-engine.entity';
import { EquipmentWing } from '../database/entities/equipment-wing.entity';
import { EquipmentParamotor } from '../database/entities/equipment-paramotor.entity';
import { EquipmentReserve } from '../database/entities/equipment-reserve.entity';
import { EquipmentParamotorWing } from '../database/entities/equipment-paramotor-wing.entity';
import { EngineServiceRecord } from '../database/entities/equipment-engine-service-record.entity';
import { WingInspectionRecord } from '../database/entities/equipment-wing-inspection-record.entity';
import { ReservePackRecord } from '../database/entities/equipment-reserve-pack-record.entity';
import { ReserveInspectionRecord } from '../database/entities/equipment-reserve-inspection-record.entity';
import { LogbookEntry } from '../database/entities/logbook-entry.entity';
import { EquipmentService } from './equipment.service';
import { EquipmentHoursService } from './equipment-hours.service';
import { EquipmentController } from './equipment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipmentEngine,
      EquipmentWing,
      EquipmentParamotor,
      EquipmentReserve,
      EquipmentParamotorWing,
      EngineServiceRecord,
      WingInspectionRecord,
      ReservePackRecord,
      ReserveInspectionRecord,
      LogbookEntry,
    ]),
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService, EquipmentHoursService],
  exports: [EquipmentService, EquipmentHoursService],
})
export class EquipmentModule {}
