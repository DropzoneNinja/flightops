import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, MoreThan } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as http from 'http';
import { Pilot } from '../database/entities/pilot.entity';
import { SettingsService } from '../settings/settings.service';
import { SettingKey } from '../settings/constants/default-settings';
import { BoundingBox } from './interfaces/bounding-box.interface';
import { AircraftPosition } from './interfaces/aircraft-position.interface';
import { OpenSkyApiResponse } from './interfaces/opensky-response.interface';
import { OpenSkyStatsService } from './opensky-stats.service';

@Injectable()
export class OpenSkyService implements OnModuleDestroy {
  private readonly logger = new Logger(OpenSkyService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly BASE_URL = 'https://opensky-network.org/api';
  private readonly MIN_INTERVAL_MS = 10_000;

  private pendingTimer: NodeJS.Timeout | null = null;
  private aircraftCache: AircraftPosition[] = [];
  private aircraftCacheTime: number = 0; // unix ms of last successful OpenSky response
  private lastApiCallTime = 0;
  private backoffUntil = 0;
  private consecutiveRateLimitErrors = 0;

  constructor(
    @InjectRepository(Pilot)
    private readonly pilotsRepository: Repository<Pilot>,
    private readonly settingsService: SettingsService,
    private readonly statsService: OpenSkyStatsService,
  ) {
    const httpsAgent = new https.Agent({ family: 4, keepAlive: true, timeout: 30000 });
    const httpAgent = new http.Agent({ family: 4, keepAlive: true, timeout: 30000 });

    this.axiosInstance = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      httpAgent,
      httpsAgent,
      headers: { 'User-Agent': 'FlightOps-OpenSky-Service/1.0' },
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`Requesting: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error(`Request setup failed: ${error.message}`);
        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        if (error.code === 'ETIMEDOUT') {
          this.logger.error(`Connection timeout reaching ${this.BASE_URL}`);
        } else if (error.code === 'ENOTFOUND') {
          this.logger.error(`DNS resolution failed for ${this.BASE_URL}`);
        } else if (error.code === 'ECONNREFUSED') {
          this.logger.error(`Connection refused by ${this.BASE_URL}`);
        }
        return Promise.reject(error);
      },
    );
  }

  onModuleDestroy(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  getAircraftSnapshot(): { positions: AircraftPosition[]; updated_at: string | null } {
    return {
      positions: this.aircraftCache,
      updated_at: this.aircraftCacheTime > 0
        ? new Date(this.aircraftCacheTime).toISOString()
        : null,
    };
  }

  /**
   * Called by PilotsService on every position update.
   * Schedules an OpenSky query respecting the 10s minimum interval.
   * If a query is already pending, the existing timer is reused (no duplicate calls).
   */
  triggerUpdate(): void {
    const now = Date.now();

    if (now < this.backoffUntil) {
      const remaining = Math.ceil((this.backoffUntil - now) / 1000);
      this.logger.debug(`OpenSky in backoff — ignoring trigger for ${remaining}s`);
      return;
    }

    // Already have a pending query scheduled — nothing more to do
    if (this.pendingTimer) return;

    const elapsed = now - this.lastApiCallTime;
    const delay = Math.max(0, this.MIN_INTERVAL_MS - elapsed);

    if (delay === 0) {
      void this.executeUpdate();
    } else {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        void this.executeUpdate();
      }, delay);
      this.logger.debug(`OpenSky query scheduled in ${delay}ms`);
    }
  }

  private async executeUpdate(): Promise<void> {
    try {
      // Ignore pilots whose position hasn't been updated in 30 min — their Flying
      // state is stale (app closed without sending Landed).
      const activeAfter = new Date(Date.now() - 30 * 60 * 1000);
      const flyingPilots = await this.pilotsRepository.find({
        where: {
          flight_state: 'Flying',
          lat: Not(IsNull()),
          lon: Not(IsNull()),
          position_updated_at: MoreThan(activeAfter),
        },
      });

      if (flyingPilots.length === 0) {
        this.aircraftCache = [];
        return;
      }

      const radiusKm = (await this.settingsService.getValue(
        SettingKey.OPENSKY_AIRSPACE_RADIUS_KM,
      )) as number;

      const boxes = flyingPilots.map((p) =>
        this.computeBoundingBox(Number(p.lat), Number(p.lon), radiusKm),
      );
      const clusters = this.mergeBoundingBoxes(boxes);

      this.logger.log(
        `Querying ${clusters.length} cluster(s) for ${flyingPilots.length} flying pilot(s)`,
      );

      const allAircraft: AircraftPosition[] = [];
      for (const box of clusters) {
        const aircraft = await this.fetchAircraft(box);
        allAircraft.push(...aircraft);
      }

      this.aircraftCache = this.deduplicateByIcao24(allAircraft);
      this.aircraftCacheTime = Date.now();
    } catch (error) {
      this.logger.error(`OpenSky update failed: ${error.message}`);
    }
  }

  private computeBoundingBox(lat: number, lon: number, radiusKm: number): BoundingBox {
    const latDelta = radiusKm / 111.32;
    const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    return {
      lamin: lat - latDelta,
      lamax: lat + latDelta,
      lomin: lon - lonDelta,
      lomax: lon + lonDelta,
    };
  }

  private boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return (
      a.lamin <= b.lamax &&
      a.lamax >= b.lamin &&
      a.lomin <= b.lomax &&
      a.lomax >= b.lomin
    );
  }

  private mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox[] {
    const clusters: BoundingBox[] = [];

    for (const box of boxes) {
      let merged = false;
      for (const cluster of clusters) {
        if (this.boxesOverlap(cluster, box)) {
          cluster.lamin = Math.min(cluster.lamin, box.lamin);
          cluster.lamax = Math.max(cluster.lamax, box.lamax);
          cluster.lomin = Math.min(cluster.lomin, box.lomin);
          cluster.lomax = Math.max(cluster.lomax, box.lomax);
          merged = true;
          break;
        }
      }
      if (!merged) {
        clusters.push({ ...box });
      }
    }

    // Second pass: re-merge clusters that expansion caused to overlap
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          if (this.boxesOverlap(clusters[i], clusters[j])) {
            clusters[i].lamin = Math.min(clusters[i].lamin, clusters[j].lamin);
            clusters[i].lamax = Math.max(clusters[i].lamax, clusters[j].lamax);
            clusters[i].lomin = Math.min(clusters[i].lomin, clusters[j].lomin);
            clusters[i].lomax = Math.max(clusters[i].lomax, clusters[j].lomax);
            clusters.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    return clusters;
  }

  private async fetchAircraft(box: BoundingBox): Promise<AircraftPosition[]> {
    const now = Date.now();

    if (now < this.backoffUntil) {
      const remaining = Math.ceil((this.backoffUntil - now) / 1000);
      this.logger.debug(`OpenSky in backoff — skipping call for ${remaining}s`);
      return [];
    }

    // Enforce minimum interval between successive API calls (multi-cluster guard)
    const elapsed = now - this.lastApiCallTime;
    if (elapsed < this.MIN_INTERVAL_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.MIN_INTERVAL_MS - elapsed),
      );
    }
    this.lastApiCallTime = Date.now();

    try {
      const response = await this.axiosInstance.get<OpenSkyApiResponse>('/states/all', {
        params: {
          lamin: box.lamin,
          lomin: box.lomin,
          lamax: box.lamax,
          lomax: box.lomax,
        },
      });

      this.consecutiveRateLimitErrors = 0;
      void this.statsService.recordCall(false);

      const states = response.data.states;
      if (!states) return [];

      return states
        .filter((s) => s[6] !== null && s[5] !== null)
        .map((s) => ({
          icao24: s[0],
          callsign: s[1]?.trim() || null,
          lat: s[6] as number,
          lon: s[5] as number,
          altitude_m: s[7],
          on_ground: s[8],
          velocity_mps: s[9],
          heading_deg: s[10],
          vertical_rate_mps: s[11],
          last_contact: s[4],
        }));
    } catch (error) {
      if (error.response?.status === 429) {
        this.consecutiveRateLimitErrors++;
        void this.statsService.recordCall(true);
        // Exponential backoff starting at 30min, capped at 60min
        const backoffMs = Math.min(1_800_000 * Math.pow(2, this.consecutiveRateLimitErrors - 1), 3_600_000);
        this.backoffUntil = Date.now() + backoffMs;
        this.logger.warn(
          `OpenSky rate limited (429) — backing off for ${backoffMs / 60_000}min (attempt ${this.consecutiveRateLimitErrors})`,
        );
      } else {
        this.logger.error(`OpenSky fetch failed for bbox: ${error.message}`);
      }
      return [];
    }
  }

  private deduplicateByIcao24(aircraft: AircraftPosition[]): AircraftPosition[] {
    const map = new Map<string, AircraftPosition>();
    for (const a of aircraft) {
      const existing = map.get(a.icao24);
      if (!existing || a.last_contact > existing.last_contact) {
        map.set(a.icao24, a);
      }
    }
    return Array.from(map.values());
  }
}
