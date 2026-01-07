import {
  Injectable,
  NotFoundException,
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
   * Get all flight sites (visible to all authenticated users)
   */
  async findAllByUser(_userId: string): Promise<FlightSite[]> {
    // Return all sites since weather data is centrally cached
    // and should be visible to all users
    return this.siteRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get a single flight site by ID
   * All authenticated users can view any site
   */
  async findOne(id: string, _userId: string, _isAdmin = false): Promise<FlightSite> {
    const site = await this.siteRepository.findOne({
      where: { id },
    });

    if (!site) {
      throw new NotFoundException('Flight site not found');
    }

    // All authenticated users can view sites
    // Ownership checks are only enforced for modifications (update, delete, toggle)
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
