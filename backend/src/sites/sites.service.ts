import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightSite } from '../database/entities/flight-site.entity';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { GeocodingService } from './services/geocoding.service';
import { GeocodingResponse } from './interfaces/geocoding-response.interface';

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(
    @InjectRepository(FlightSite)
    private readonly siteRepository: Repository<FlightSite>,
    private readonly geocodingService: GeocodingService,
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

  /**
   * Find sites whose takeoff point is within radiusM metres of the given coordinates.
   * Used to auto-detect the launch site from a GPX takeoff point.
   */
  async findNear(
    lat: number,
    lon: number,
    radiusM: number,
  ): Promise<FlightSite[]> {
    const all = await this.siteRepository.find();
    return all.filter((site) => {
      const dist = haversineM(lat, lon, Number(site.takeoff_lat), Number(site.takeoff_lon));
      return dist <= radiusM;
    });
  }

  /**
   * Reverse geocode parking coordinates to get nearest address
   * Uses database caching to avoid repeated API calls
   */
  async reverseGeocode(
    userId: string,
    lat: number,
    lon: number,
  ): Promise<GeocodingResponse> {
    this.logger.log(`Reverse geocoding for user ${userId}: (${lat}, ${lon})`);

    // Query database for FlightSite with matching parking coordinates
    const site = await this.siteRepository.findOne({
      where: {
        user_id: userId,
        parking_lat: lat,
        parking_lon: lon,
      },
    });

    // If site found and has cached address, return it
    if (site && site.parking_address) {
      this.logger.log(`Using cached address from database for site: ${site.name}`);
      return {
        formattedAddress: site.parking_address,
        displayName: site.parking_address,
      };
    }

    // No cache found, call geocoding API
    this.logger.log('No cached address found, calling Nominatim API');
    try {
      const result = await this.geocodingService.reverseGeocode(lat, lon);

      // If site exists, update it with the fetched address
      if (site) {
        site.parking_address = result.formattedAddress;
        await this.siteRepository.save(site);
        this.logger.log(`Cached address for site: ${site.name}`);
      } else {
        this.logger.warn(
          `No site found for coordinates (${lat}, ${lon}), address not cached`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Reverse geocoding failed: ${error.message}`);
      throw new Error('Unable to fetch address for coordinates');
    }
  }
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
