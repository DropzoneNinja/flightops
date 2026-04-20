import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Mission } from '../database/entities/mission.entity';
import { MissionWaypoint } from '../database/entities/mission-waypoint.entity';
import { User } from '../database/entities/user.entity';
import {
  CreateMissionDto,
  UpdateMissionDto,
  CreateWaypointDto,
  UpdateWaypointDto,
} from './dto';

export interface MissionListQuery {
  search?: string;
  launchSiteId?: string;
  sort?: 'updated_at' | 'name' | 'created_at';
  order?: 'ASC' | 'DESC';
}

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionWaypoint)
    private readonly waypointRepository: Repository<MissionWaypoint>,
  ) {}

  private canUserEdit(mission: Mission, user: User): boolean {
    return user.is_admin || mission.created_by === null || mission.created_by === user.id;
  }

  async findAll(query: MissionListQuery = {}): Promise<Mission[]> {
    const { search, launchSiteId, sort = 'updated_at', order = 'DESC' } = query;

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    if (launchSiteId) {
      where.launch_site_id = launchSiteId;
    }

    return this.missionRepository.find({
      where,
      relations: ['launch_site', 'waypoints', 'creator'],
      order: { [sort]: order },
    });
  }

  async findOne(id: string): Promise<Mission> {
    const mission = await this.missionRepository.findOne({
      where: { id },
      relations: ['launch_site', 'waypoints', 'creator'],
      order: { waypoints: { sort_order: 'ASC' } },
    });

    if (!mission) {
      throw new NotFoundException('Mission not found');
    }

    return mission;
  }

  async create(createMissionDto: CreateMissionDto, userId: string): Promise<Mission> {
    const mission = this.missionRepository.create({
      name: createMissionDto.name,
      notes: createMissionDto.notes ?? null,
      launch_site_id: createMissionDto.launch_site_id ?? null,
      avg_fuel_consumption: createMissionDto.avg_fuel_consumption ?? null,
      fuel_tank_size: createMissionDto.fuel_tank_size ?? null,
      wind_direction: createMissionDto.wind_direction ?? null,
      wind_speed: createMissionDto.wind_speed ?? null,
      created_by: userId,
    });

    const saved = await this.missionRepository.save(mission);
    return this.findOne(saved.id);
  }

  async update(id: string, updateMissionDto: UpdateMissionDto, user: User): Promise<Mission> {
    const mission = await this.findOne(id);

    if (!this.canUserEdit(mission, user)) {
      throw new ForbiddenException('You do not have permission to edit this mission');
    }

    if (updateMissionDto.name !== undefined) mission.name = updateMissionDto.name;
    if (updateMissionDto.notes !== undefined) mission.notes = updateMissionDto.notes ?? null;
    if ('launch_site_id' in updateMissionDto) {
      mission.launch_site_id = updateMissionDto.launch_site_id ?? null;
    }
    if ('avg_speed' in updateMissionDto) {
      mission.avg_speed = updateMissionDto.avg_speed ?? null;
    }
    if ('avg_fuel_consumption' in updateMissionDto) {
      mission.avg_fuel_consumption = updateMissionDto.avg_fuel_consumption ?? null;
    }
    if ('fuel_tank_size' in updateMissionDto) {
      mission.fuel_tank_size = updateMissionDto.fuel_tank_size ?? null;
    }
    if ('wind_direction' in updateMissionDto) {
      mission.wind_direction = updateMissionDto.wind_direction ?? null;
    }
    if ('wind_speed' in updateMissionDto) {
      mission.wind_speed = updateMissionDto.wind_speed ?? null;
    }

    await this.missionRepository.save(mission);
    return this.findOne(id);
  }

  async remove(id: string, user: User): Promise<void> {
    const mission = await this.findOne(id);

    if (!this.canUserEdit(mission, user)) {
      throw new ForbiddenException('You do not have permission to delete this mission');
    }

    await this.missionRepository.remove(mission);
  }

  async duplicate(id: string, userId: string): Promise<Mission> {
    const source = await this.findOne(id);

    const newMission = this.missionRepository.create({
      name: `${source.name} (copy)`,
      notes: source.notes,
      launch_site_id: source.launch_site_id,
      avg_fuel_consumption: source.avg_fuel_consumption,
      fuel_tank_size: source.fuel_tank_size,
      wind_direction: source.wind_direction,
      wind_speed: source.wind_speed,
      created_by: userId,
    });

    const saved = await this.missionRepository.save(newMission);

    if (source.waypoints && source.waypoints.length > 0) {
      const waypoints = source.waypoints.map((wp) =>
        this.waypointRepository.create({
          mission_id: saved.id,
          sort_order: wp.sort_order,
          latitude: wp.latitude,
          longitude: wp.longitude,
          altitude: wp.altitude,
          planned_speed: wp.planned_speed,
          leg_minutes: wp.leg_minutes,
        }),
      );
      await this.waypointRepository.save(waypoints);
    }

    return this.findOne(saved.id);
  }

  // Waypoint methods

  async addWaypoint(missionId: string, dto: CreateWaypointDto, user: User): Promise<MissionWaypoint> {
    const mission = await this.findOne(missionId);

    if (!this.canUserEdit(mission, user)) {
      throw new ForbiddenException('You do not have permission to edit this mission');
    }

    const maxOrder = await this.waypointRepository
      .createQueryBuilder('wp')
      .select('MAX(wp.sort_order)', 'max')
      .where('wp.mission_id = :missionId', { missionId })
      .getRawOne<{ max: number | null }>();

    const nextOrder = (maxOrder?.max ?? -1) + 1;

    const waypoint = this.waypointRepository.create({
      mission_id: missionId,
      sort_order: nextOrder,
      latitude: dto.latitude,
      longitude: dto.longitude,
      altitude: dto.altitude ?? null,
      planned_speed: dto.planned_speed ?? null,
      leg_minutes: dto.leg_minutes ?? null,
    });

    await this.waypointRepository.save(waypoint);
    await this.missionRepository.update(missionId, { updated_at: new Date() });

    return waypoint;
  }

  async updateWaypoint(
    missionId: string,
    waypointId: string,
    dto: UpdateWaypointDto,
    user: User,
  ): Promise<MissionWaypoint> {
    const mission = await this.findOne(missionId);
    if (!this.canUserEdit(mission, user)) {
      throw new ForbiddenException('You do not have permission to edit this mission');
    }

    const waypoint = await this.waypointRepository.findOne({
      where: { id: waypointId, mission_id: missionId },
    });

    if (!waypoint) {
      throw new NotFoundException('Waypoint not found');
    }

    if (dto.latitude !== undefined) waypoint.latitude = dto.latitude;
    if (dto.longitude !== undefined) waypoint.longitude = dto.longitude;
    if (dto.altitude !== undefined) waypoint.altitude = dto.altitude ?? null;
    if (dto.planned_speed !== undefined) waypoint.planned_speed = dto.planned_speed ?? null;
    if (dto.leg_minutes !== undefined) waypoint.leg_minutes = dto.leg_minutes ?? null;

    await this.waypointRepository.save(waypoint);
    await this.missionRepository.update(missionId, { updated_at: new Date() });

    return waypoint;
  }

  async removeWaypoint(missionId: string, waypointId: string, user: User): Promise<void> {
    const mission = await this.findOne(missionId);
    if (!this.canUserEdit(mission, user)) {
      throw new ForbiddenException('You do not have permission to edit this mission');
    }

    const waypoint = await this.waypointRepository.findOne({
      where: { id: waypointId, mission_id: missionId },
    });

    if (!waypoint) {
      throw new NotFoundException('Waypoint not found');
    }

    const removedOrder = waypoint.sort_order;
    await this.waypointRepository.remove(waypoint);

    // Compact sort_order for remaining waypoints after the removed one
    await this.waypointRepository
      .createQueryBuilder()
      .update(MissionWaypoint)
      .set({ sort_order: () => 'sort_order - 1' })
      .where('mission_id = :missionId AND sort_order > :removedOrder', {
        missionId,
        removedOrder,
      })
      .execute();

    await this.missionRepository.update(missionId, { updated_at: new Date() });
  }

  async reorderWaypoints(missionId: string, waypointIds: string[], user: User): Promise<MissionWaypoint[]> {
    const mission = await this.findOne(missionId);
    if (!this.canUserEdit(mission, user)) {
      throw new ForbiddenException('You do not have permission to edit this mission');
    }

    const existing = await this.waypointRepository.find({
      where: { mission_id: missionId },
    });

    if (existing.length !== waypointIds.length) {
      throw new BadRequestException('waypoint_ids must include all waypoints for this mission');
    }

    const updates = waypointIds.map((wpId, index) => {
      const wp = existing.find((w) => w.id === wpId);
      if (!wp) {
        throw new BadRequestException(`Waypoint ${wpId} does not belong to mission ${missionId}`);
      }
      wp.sort_order = index;
      return wp;
    });

    await this.waypointRepository.save(updates);
    await this.missionRepository.update(missionId, { updated_at: new Date() });

    return updates.sort((a, b) => a.sort_order - b.sort_order);
  }

  async getWaypoints(missionId: string): Promise<MissionWaypoint[]> {
    await this.findOne(missionId);

    return this.waypointRepository.find({
      where: { mission_id: missionId },
      order: { sort_order: 'ASC' },
    });
  }
}
