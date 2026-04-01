import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from '../database/entities/flight.entity';
import { FlightScore } from '../database/entities/flight-score.entity';
import { Pilot } from '../database/entities/pilot.entity';

export type LeaderboardCategory =
  | 'overall'
  | 'takeoff'
  | 'climb'
  | 'level'
  | 'turn'
  | 'descent'
  | 'landing'
  | 'smoothness'
  | 'safety'
  | 'most_improved';

export type LeaderboardPeriod = 'alltime' | '30d' | 'season';

export interface LeaderboardEntry {
  rank: number;
  pilot: Pilot;
  score: number;
  flight_id: string;
  flight_date: string;
  site_id: string | null;
  glider: string | null;
  improvement?: number; // only for most_improved
}

const SCORE_COLUMN: Record<LeaderboardCategory, keyof FlightScore | null> = {
  overall: 'overall_score',
  takeoff: 'takeoff_score',
  climb: 'climb_score',
  level: 'level_score',
  turn: 'turn_score',
  descent: 'descent_score',
  landing: 'landing_score',
  smoothness: 'smoothness_score',
  safety: 'safety_score',
  most_improved: null,
};

@Injectable()
export class LeaderboardsService {
  constructor(
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    @InjectRepository(FlightScore)
    private readonly scoresRepository: Repository<FlightScore>,
    @InjectRepository(Pilot)
    private readonly pilotsRepository: Repository<Pilot>,
  ) {}

  async getLeaderboard(
    category: LeaderboardCategory = 'overall',
    period: LeaderboardPeriod = 'alltime',
    siteId?: string,
  ): Promise<LeaderboardEntry[]> {
    if (category === 'most_improved') {
      return this.getMostImproved(period, siteId);
    }

    const col = SCORE_COLUMN[category];
    if (!col) return [];

    const cutoff = this.getPeriodCutoff(period);

    // Build query: for each pilot find their best score in the given category
    // within the period, filtered by site if given.
    const qb = this.scoresRepository
      .createQueryBuilder('fs')
      .innerJoin(Flight, 'f', 'f.id = fs.flight_id')
      .innerJoinAndMapOne('fs.flight', Flight, 'fl', 'fl.id = fs.flight_id')
      .where('f.parse_status = :status', { status: 'analyzed' })
      .andWhere('f.analysis_status = :as', { as: 'complete' })
      .andWhere(`fs.${col} IS NOT NULL`)
      .andWhere('f.pilot_id IS NOT NULL');

    if (cutoff) {
      qb.andWhere('f.flight_date >= :cutoff', { cutoff });
    }
    if (siteId) {
      qb.andWhere('f.site_id = :siteId', { siteId });
    }

    const scores = await qb
      .select([
        'fs.flight_id',
        `fs.${col}`,
        'f.pilot_id',
        'f.flight_date',
        'f.site_id',
        'f.glider',
      ])
      .getRawMany();

    // Group by pilot: keep only the best score per pilot
    const bestByPilot = new Map<
      string,
      { score: number; flight_id: string; flight_date: string; site_id: string | null; glider: string | null }
    >();

    for (const row of scores) {
      const pilotId: string = row['f_pilot_id'];
      const score: number = parseFloat(row[`fs_${col}`]);
      const flightId: string = row['fs_flight_id'];
      const flightDate: string = row['f_flight_date'];
      const sId: string | null = row['f_site_id'] ?? null;
      const glider: string | null = row['f_glider'] ?? null;

      const existing = bestByPilot.get(pilotId);
      if (!existing || score > existing.score) {
        bestByPilot.set(pilotId, { score, flight_id: flightId, flight_date: flightDate, site_id: sId, glider });
      }
    }

    if (bestByPilot.size === 0) return [];

    // Load pilots
    const pilotIds = [...bestByPilot.keys()];
    const pilots = await this.pilotsRepository.findByIds(pilotIds);
    const pilotMap = new Map(pilots.map((p) => [p.id, p]));

    // Build ranked list
    const entries: LeaderboardEntry[] = [];
    for (const [pilotId, data] of bestByPilot.entries()) {
      const pilot = pilotMap.get(pilotId);
      if (!pilot) continue;
      entries.push({
        rank: 0, // set below
        pilot,
        score: Math.round(data.score * 10) / 10,
        flight_id: data.flight_id,
        flight_date: String(data.flight_date),
        site_id: data.site_id,
        glider: data.glider,
      });
    }

    entries.sort((a, b) => b.score - a.score);
    entries.forEach((e, i) => (e.rank = i + 1));

    return entries;
  }

  private async getMostImproved(
    period: LeaderboardPeriod,
    siteId?: string,
  ): Promise<LeaderboardEntry[]> {
    const cutoff = this.getPeriodCutoff(period);

    const qb = this.scoresRepository
      .createQueryBuilder('fs')
      .innerJoin(Flight, 'f', 'f.id = fs.flight_id')
      .where('f.parse_status = :status', { status: 'analyzed' })
      .andWhere('f.analysis_status = :as', { as: 'complete' })
      .andWhere('f.pilot_id IS NOT NULL')
      .andWhere('fs.overall_score IS NOT NULL');

    if (cutoff) {
      qb.andWhere('f.flight_date >= :cutoff', { cutoff });
    }
    if (siteId) {
      qb.andWhere('f.site_id = :siteId', { siteId });
    }

    const rows = await qb
      .select(['f.pilot_id', 'fs.overall_score', 'fs.flight_id', 'f.flight_date', 'f.glider', 'f.site_id'])
      .orderBy('f.flight_date', 'ASC')
      .getRawMany();

    // Per pilot: compute improvement = latest overall_score - earliest overall_score
    const pilotFlights = new Map<string, { score: number; flight_id: string; flight_date: string; glider: string | null; site_id: string | null }[]>();
    for (const row of rows) {
      const pilotId: string = row['f_pilot_id'];
      const score: number = parseFloat(row['fs_overall_score']);
      if (!pilotFlights.has(pilotId)) pilotFlights.set(pilotId, []);
      pilotFlights.get(pilotId)!.push({
        score,
        flight_id: row['fs_flight_id'],
        flight_date: row['f_flight_date'],
        glider: row['f_glider'] ?? null,
        site_id: row['f_site_id'] ?? null,
      });
    }

    const improvements: { pilotId: string; improvement: number; latest: { score: number; flight_id: string; flight_date: string; glider: string | null; site_id: string | null } }[] = [];
    for (const [pilotId, flights] of pilotFlights.entries()) {
      if (flights.length < 2) continue;
      const earliest = flights[0];
      const latest = flights[flights.length - 1];
      const improvement = latest.score - earliest.score;
      if (improvement > 0) {
        improvements.push({ pilotId, improvement, latest });
      }
    }

    if (improvements.length === 0) return [];

    improvements.sort((a, b) => b.improvement - a.improvement);

    const pilotIds = improvements.map((i) => i.pilotId);
    const pilots = await this.pilotsRepository.findByIds(pilotIds);
    const pilotMap = new Map(pilots.map((p) => [p.id, p]));

    return improvements
      .map((item, idx) => {
        const pilot = pilotMap.get(item.pilotId);
        if (!pilot) return null;
        return {
          rank: idx + 1,
          pilot,
          score: Math.round(item.latest.score * 10) / 10,
          flight_id: item.latest.flight_id,
          flight_date: String(item.latest.flight_date),
          site_id: item.latest.site_id,
          glider: item.latest.glider,
          improvement: Math.round(item.improvement * 10) / 10,
        } as LeaderboardEntry;
      })
      .filter((e): e is LeaderboardEntry => e !== null);
  }

  private getPeriodCutoff(period: LeaderboardPeriod): Date | null {
    if (period === 'alltime') return null;
    const now = new Date();
    if (period === '30d') {
      now.setDate(now.getDate() - 30);
      return now;
    }
    if (period === 'season') {
      // Current year Jan 1
      return new Date(now.getFullYear(), 0, 1);
    }
    return null;
  }
}
