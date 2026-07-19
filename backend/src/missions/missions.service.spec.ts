import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { Mission } from '../database/entities/mission.entity';
import { MissionWaypoint } from '../database/entities/mission-waypoint.entity';
import { User } from '../database/entities/user.entity';

const adminUser = { id: 'user-admin', is_admin: true } as User;
const regularUser = { id: 'user-1', is_admin: false } as User;

const mockMission = (overrides: Partial<Mission> = {}): Mission => ({
  id: 'mission-1',
  name: 'Test Mission',
  notes: null,
  launch_site_id: null,
  created_by: null,
  launch_site: null,
  creator: null,
  waypoints: [],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  ...overrides,
} as Mission);

const mockWaypoint = (overrides: Partial<MissionWaypoint> = {}): MissionWaypoint => ({
  id: 'wp-1',
  mission_id: 'mission-1',
  sort_order: 0,
  latitude: 47.5,
  longitude: 8.5,
  altitude: null,
  planned_speed: null,
  leg_minutes: null,
  created_at: new Date(),
  updated_at: new Date(),
  mission: null,
  ...overrides,
} as MissionWaypoint);

const makeQb = (results: Mission[] = []) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(results),
});

const makeMissionRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
});

const makeWaypointRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('MissionsService', () => {
  let service: MissionsService;
  let missionRepo: ReturnType<typeof makeMissionRepo>;
  let waypointRepo: ReturnType<typeof makeWaypointRepo>;

  beforeEach(async () => {
    missionRepo = makeMissionRepo();
    waypointRepo = makeWaypointRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionsService,
        { provide: getRepositoryToken(Mission), useValue: missionRepo },
        { provide: getRepositoryToken(MissionWaypoint), useValue: waypointRepo },
      ],
    }).compile();

    service = module.get<MissionsService>(MissionsService);
  });

  describe('findAll', () => {
    it('returns all missions', async () => {
      const missions = [mockMission()];
      const qb = makeQb(missions);
      missionRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findAll({});
      expect(result).toEqual(missions);
      expect(missionRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('does not scope results by ownership', async () => {
      const qb = makeQb([]);
      missionRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({});
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('applies search filter', async () => {
      const qb = makeQb([]);
      missionRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ search: 'foo' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%foo%' }),
      );
    });

    it('applies launchSiteId filter', async () => {
      const qb = makeQb([]);
      missionRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ launchSiteId: 'site-1' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('launch_site_id'),
        expect.objectContaining({ launchSiteId: 'site-1' }),
      );
    });
  });

  describe('findOne', () => {
    it('returns mission when found', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      const result = await service.findOne('mission-1');
      expect(result).toEqual(mission);
    });

    it('throws NotFoundException when not found', async () => {
      missionRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and saves a mission', async () => {
      const mission = mockMission();
      missionRepo.create.mockReturnValue(mission);
      missionRepo.save.mockResolvedValue(mission);
      missionRepo.findOne.mockResolvedValue(mission);
      const result = await service.create({ name: 'Test Mission' }, adminUser.id);
      expect(result).toEqual(mission);
      expect(missionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Mission', notes: null, launch_site_id: null, created_by: adminUser.id }),
      );
    });

    it('sets launch_site_id when provided', async () => {
      const mission = mockMission({ launch_site_id: 'site-1' });
      missionRepo.create.mockReturnValue(mission);
      missionRepo.save.mockResolvedValue(mission);
      missionRepo.findOne.mockResolvedValue(mission);
      await service.create({ name: 'Test', launch_site_id: 'site-1' }, adminUser.id);
      expect(missionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ launch_site_id: 'site-1' }),
      );
    });
  });

  describe('update', () => {
    it('updates mission fields', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      missionRepo.save.mockResolvedValue(mission);
      await service.update('mission-1', { name: 'Updated' }, adminUser);
      expect(missionRepo.save).toHaveBeenCalled();
    });

    it('allows the owner to update their mission', async () => {
      const mission = mockMission({ created_by: regularUser.id });
      missionRepo.findOne.mockResolvedValue(mission);
      missionRepo.save.mockResolvedValue(mission);
      await service.update('mission-1', { name: 'Updated' }, regularUser);
      expect(missionRepo.save).toHaveBeenCalled();
    });

    it("throws ForbiddenException when a non-admin updates another user's mission", async () => {
      const mission = mockMission({ created_by: 'user-2' });
      missionRepo.findOne.mockResolvedValue(mission);
      await expect(service.update('mission-1', { name: 'X' }, regularUser)).rejects.toThrow(ForbiddenException);
      expect(missionRepo.save).not.toHaveBeenCalled();
    });

    it("allows an admin to update another user's mission", async () => {
      const mission = mockMission({ created_by: 'user-2' });
      missionRepo.findOne.mockResolvedValue(mission);
      missionRepo.save.mockResolvedValue(mission);
      await service.update('mission-1', { name: 'Updated' }, adminUser);
      expect(missionRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException for missing mission', async () => {
      missionRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' }, adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes mission', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      missionRepo.remove.mockResolvedValue(undefined);
      await service.remove('mission-1', adminUser);
      expect(missionRepo.remove).toHaveBeenCalledWith(mission);
    });

    it("throws ForbiddenException when a non-admin removes another user's mission", async () => {
      const mission = mockMission({ created_by: 'user-2' });
      missionRepo.findOne.mockResolvedValue(mission);
      await expect(service.remove('mission-1', regularUser)).rejects.toThrow(ForbiddenException);
      expect(missionRepo.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for missing mission', async () => {
      missionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing', adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addWaypoint', () => {
    it('appends waypoint with correct sort_order', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
      };
      waypointRepo.createQueryBuilder.mockReturnValue(qb);
      const wp = mockWaypoint({ sort_order: 2 });
      waypointRepo.create.mockReturnValue(wp);
      waypointRepo.save.mockResolvedValue(wp);
      missionRepo.update.mockResolvedValue(undefined);

      const result = await service.addWaypoint('mission-1', {
        latitude: 47.5,
        longitude: 8.5,
      }, adminUser);

      expect(waypointRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 2, latitude: 47.5, longitude: 8.5 }),
      );
      expect(result).toEqual(wp);
    });

    it("throws ForbiddenException when a non-admin adds a waypoint to another user's mission", async () => {
      const mission = mockMission({ created_by: 'user-2' });
      missionRepo.findOne.mockResolvedValue(mission);
      await expect(
        service.addWaypoint('mission-1', { latitude: 47.5, longitude: 8.5 }, regularUser),
      ).rejects.toThrow(ForbiddenException);
      expect(waypointRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('removeWaypoint', () => {
    it('removes waypoint and compacts sort_order', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      const wp = mockWaypoint({ sort_order: 1 });
      waypointRepo.findOne.mockResolvedValue(wp);
      waypointRepo.remove.mockResolvedValue(undefined);
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      waypointRepo.createQueryBuilder.mockReturnValue(qb);
      missionRepo.update.mockResolvedValue(undefined);

      await service.removeWaypoint('mission-1', 'wp-1', adminUser);
      expect(waypointRepo.remove).toHaveBeenCalledWith(wp);
      expect(qb.execute).toHaveBeenCalled();
    });

    it('throws NotFoundException for missing waypoint', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      waypointRepo.findOne.mockResolvedValue(null);
      await expect(service.removeWaypoint('mission-1', 'wp-x', adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderWaypoints', () => {
    it('reorders waypoints by id list', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      const wps = [mockWaypoint({ id: 'wp-1' }), mockWaypoint({ id: 'wp-2', sort_order: 1 })];
      waypointRepo.find.mockResolvedValue(wps);
      waypointRepo.save.mockResolvedValue(wps);
      missionRepo.update.mockResolvedValue(undefined);

      await service.reorderWaypoints('mission-1', ['wp-2', 'wp-1'], adminUser);
      const saved = waypointRepo.save.mock.calls[0][0] as MissionWaypoint[];
      const wp2 = saved.find((w) => w.id === 'wp-2');
      const wp1 = saved.find((w) => w.id === 'wp-1');
      expect(wp2!.sort_order).toBe(0);
      expect(wp1!.sort_order).toBe(1);
    });

    it('throws BadRequestException when waypoint_ids count mismatches', async () => {
      const mission = mockMission();
      missionRepo.findOne.mockResolvedValue(mission);
      waypointRepo.find.mockResolvedValue([mockWaypoint()]);
      await expect(
        service.reorderWaypoints('mission-1', ['wp-1', 'wp-2'], adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
