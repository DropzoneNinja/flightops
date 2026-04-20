import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import {
  CreateMissionDto,
  UpdateMissionDto,
  CreateWaypointDto,
  UpdateWaypointDto,
  ReorderWaypointsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('missions')
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  /**
   * GET /missions?search=&launchSiteId=&sort=&order=
   */
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('launchSiteId') launchSiteId?: string,
    @Query('sort') sort?: 'updated_at' | 'name' | 'created_at',
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    return this.missionsService.findAll({ search, launchSiteId, sort, order });
  }

  /**
   * POST /missions
   */
  @Post()
  create(@Body() createMissionDto: CreateMissionDto, @CurrentUser() user: User) {
    return this.missionsService.create(createMissionDto, user.id);
  }

  /**
   * GET /missions/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.missionsService.findOne(id);
  }

  /**
   * PUT /missions/:id
   */
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateMissionDto: UpdateMissionDto,
    @CurrentUser() user: User,
  ) {
    return this.missionsService.update(id, updateMissionDto, user);
  }

  /**
   * DELETE /missions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.missionsService.remove(id, user);
  }

  /**
   * POST /missions/:id/duplicate
   */
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() user: User) {
    return this.missionsService.duplicate(id, user.id);
  }

  /**
   * GET /missions/:id/waypoints
   */
  @Get(':id/waypoints')
  getWaypoints(@Param('id') id: string) {
    return this.missionsService.getWaypoints(id);
  }

  /**
   * POST /missions/:id/waypoints
   */
  @Post(':id/waypoints')
  addWaypoint(
    @Param('id') id: string,
    @Body() createWaypointDto: CreateWaypointDto,
    @CurrentUser() user: User,
  ) {
    return this.missionsService.addWaypoint(id, createWaypointDto, user);
  }

  /**
   * PUT /missions/:id/waypoints/:waypointId
   */
  @Put(':id/waypoints/:waypointId')
  updateWaypoint(
    @Param('id') id: string,
    @Param('waypointId') waypointId: string,
    @Body() updateWaypointDto: UpdateWaypointDto,
    @CurrentUser() user: User,
  ) {
    return this.missionsService.updateWaypoint(id, waypointId, updateWaypointDto, user);
  }

  /**
   * DELETE /missions/:id/waypoints/:waypointId
   */
  @Delete(':id/waypoints/:waypointId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeWaypoint(
    @Param('id') id: string,
    @Param('waypointId') waypointId: string,
    @CurrentUser() user: User,
  ) {
    await this.missionsService.removeWaypoint(id, waypointId, user);
  }

  /**
   * POST /missions/:id/waypoints/reorder
   */
  @Post(':id/waypoints/reorder')
  reorderWaypoints(
    @Param('id') id: string,
    @Body() reorderDto: ReorderWaypointsDto,
    @CurrentUser() user: User,
  ) {
    return this.missionsService.reorderWaypoints(id, reorderDto.waypoint_ids, user);
  }
}
