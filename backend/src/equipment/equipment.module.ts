import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEngine } from '../database/entities/equipment-engine.entity';
import { EquipmentWing } from '../database/entities/equipment-wing.entity';
import { EquipmentParamotor } from '../database/entities/equipment-paramotor.entity';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentEngine, EquipmentWing, EquipmentParamotor])],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
