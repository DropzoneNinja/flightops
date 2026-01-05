import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightSite } from '../database/entities/flight-site.entity';
import { CreateSiteDto, UpdateSiteDto } from './dto';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(FlightSite)
    private readonly siteRepository: Repository<FlightSite>,
  ) {}

  /**
   * Create a new flight site for a user
   */
  async create(userId: string, createSiteDto: CreateSiteDto): Promise<FlightSite> {
    const site = this.siteRepository.create({
      ...createSiteDto,
      user_id: userId,
    });

    return this.siteRepository.save(site);
  }

  /**
   * Get all flight sites for a user
   */
  async findAllByUser(userId: string): Promise<FlightSite[]> {
    return this.siteRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get a single flight site by ID
   */
  async findOne(id: string, userId: string, isAdmin = false): Promise<FlightSite> {
    const site = await this.siteRepository.findOne({
      where: { id },
    });

    if (!site) {
      throw new NotFoundException('Flight site not found');
    }

    // Check ownership (admins can access any site)
    if (!isAdmin && site.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this site');
    }

    return site;
  }

  /**
   * Update a flight site
   */
  async update(
    id: string,
    userId: string,
    updateSiteDto: UpdateSiteDto,
    isAdmin = false,
  ): Promise<FlightSite> {
    const site = await this.findOne(id, userId, isAdmin); // This checks ownership

    Object.assign(site, updateSiteDto);
    return this.siteRepository.save(site);
  }

  /**
   * Delete a flight site
   */
  async remove(id: string, userId: string, isAdmin = false): Promise<void> {
    const site = await this.findOne(id, userId, isAdmin); // This checks ownership
    await this.siteRepository.remove(site);
  }

  /**
   * Toggle site enabled status
   */
  async toggleEnabled(id: string, userId: string, isAdmin = false): Promise<FlightSite> {
    const site = await this.findOne(id, userId, isAdmin); // This checks ownership
    site.enabled = !site.enabled;
    return this.siteRepository.save(site);
  }
}
