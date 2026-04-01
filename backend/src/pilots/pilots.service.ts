import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pilot } from '../database/entities/pilot.entity';
import { Flight } from '../database/entities/flight.entity';
import { FlightScore } from '../database/entities/flight-score.entity';
import { CreatePilotDto } from './dto/create-pilot.dto';
import { UpdatePilotDto } from './dto/update-pilot.dto';

export interface PersonalBest {
  category: string;
  value: number;
  flight_id: string;
  flight_date: string;
}

export interface ScoreTrendPoint {
  flight_id: string;
  flight_date: string;
  overall_score: number;
  takeoff_score: number | null;
  climb_score: number | null;
  level_score: number | null;
  turn_score: number | null;
  descent_score: number | null;
  landing_score: number | null;
  smoothness_score: number | null;
  safety_score: number | null;
}

export interface PilotPerformanceData {
  pilot: Pilot;
  total_flights: number;
  recent_flights: Flight[];
  score_trend: ScoreTrendPoint[];
  personal_bests: PersonalBest[];
  rolling_30d_avg: number | null;
}

@Injectable()
export class PilotsService {
  constructor(
    @InjectRepository(Pilot)
    private readonly pilotsRepository: Repository<Pilot>,
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    @InjectRepository(FlightScore)
    private readonly scoresRepository: Repository<FlightScore>,
  ) {}

  async findAll(): Promise<Pilot[]> {
    return this.pilotsRepository.find({ order: { display_name: 'ASC' } });
  }

  async findById(id: string): Promise<Pilot> {
    const pilot = await this.pilotsRepository.findOne({ where: { id } });
    if (!pilot) throw new NotFoundException(`Pilot with ID ${id} not found`);
    return pilot;
  }

  async findBySlug(slug: string): Promise<Pilot | null> {
    return this.pilotsRepository.findOne({ where: { slug } });
  }

  async create(dto: CreatePilotDto): Promise<Pilot> {
    const slug = dto.slug ?? this.generateSlug(dto.display_name);
    const existing = await this.findBySlug(slug);
    if (existing) throw new ConflictException(`Pilot with slug "${slug}" already exists`);

    const pilot = this.pilotsRepository.create({ ...dto, slug });
    return this.pilotsRepository.save(pilot);
  }

  async update(id: string, dto: UpdatePilotDto): Promise<Pilot> {
    const pilot = await this.findById(id);
    Object.assign(pilot, dto);
    return this.pilotsRepository.save(pilot);
  }

  async delete(id: string): Promise<void> {
    const pilot = await this.findById(id);
    await this.pilotsRepository.remove(pilot);
  }

  /** GET /pilots/:id/performance — recent flights, score trends, personal bests */
  async getPerformance(id: string): Promise<PilotPerformanceData> {
    const pilot = await this.findById(id);

    // All analyzed flights for this pilot ordered by date desc
    const allFlights = await this.flightsRepository.find({
      where: { pilot_id: id, parse_status: 'analyzed' },
      order: { flight_date: 'DESC', start_at: 'DESC' },
      select: [
        'id', 'flight_date', 'title', 'start_at', 'end_at',
        'duration_seconds', 'total_distance_m', 'max_altitude_m',
        'avg_speed_mps', 'max_speed_mps', 'max_climb_mps',
        'analysis_status', 'parse_status', 'glider', 'harness',
        'launch_site_name', 'original_filename', 'confidence_score',
      ],
    });

    const total_flights = allFlights.length;
    const recent_flights = allFlights.slice(0, 10);
    const flightIds = allFlights.map((f) => f.id);

    if (flightIds.length === 0) {
      return {
        pilot,
        total_flights: 0,
        recent_flights: [],
        score_trend: [],
        personal_bests: [],
        rolling_30d_avg: null,
      };
    }

    // Load scores for all flights
    const scores = await this.scoresRepository
      .createQueryBuilder('fs')
      .where('fs.flight_id IN (:...flightIds)', { flightIds })
      .orderBy('fs.created_at', 'ASC')
      .getMany();

    // Build a map of flight_id -> flight for date lookup
    const flightMap = new Map(allFlights.map((f) => [f.id, f]));

    // Score trend (chronological order for chart)
    const score_trend: ScoreTrendPoint[] = scores
      .map((s) => {
        const f = flightMap.get(s.flight_id);
        if (!f) return null;
        return {
          flight_id: s.flight_id,
          flight_date: f.flight_date instanceof Date
            ? f.flight_date.toISOString().split('T')[0]
            : String(f.flight_date),
          overall_score: s.overall_score,
          takeoff_score: s.takeoff_score,
          climb_score: s.climb_score,
          level_score: s.level_score,
          turn_score: s.turn_score,
          descent_score: s.descent_score,
          landing_score: s.landing_score,
          smoothness_score: s.smoothness_score,
          safety_score: s.safety_score,
        };
      })
      .filter((x): x is ScoreTrendPoint => x !== null)
      .sort((a, b) => a.flight_date.localeCompare(b.flight_date));

    // Personal bests
    const personal_bests: PersonalBest[] = [];
    const categories: Array<keyof FlightScore> = [
      'overall_score', 'takeoff_score', 'climb_score', 'level_score',
      'turn_score', 'descent_score', 'landing_score', 'smoothness_score', 'safety_score',
    ];
    for (const cat of categories) {
      let best: FlightScore | null = null;
      for (const s of scores) {
        const val = s[cat] as number | null;
        if (val === null) continue;
        if (!best || val > (best[cat] as number)) best = s;
      }
      if (best) {
        const f = flightMap.get(best.flight_id);
        personal_bests.push({
          category: cat,
          value: best[cat] as number,
          flight_id: best.flight_id,
          flight_date: f
            ? f.flight_date instanceof Date
              ? f.flight_date.toISOString().split('T')[0]
              : String(f.flight_date)
            : '',
        });
      }
    }

    // Rolling 30-day average
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent30dFlightIds = allFlights
      .filter((f) => {
        const d = f.flight_date instanceof Date ? f.flight_date : new Date(f.flight_date);
        return d >= thirtyDaysAgo;
      })
      .map((f) => f.id);
    const recent30dScores = scores.filter((s) => recent30dFlightIds.includes(s.flight_id));
    const rolling_30d_avg =
      recent30dScores.length > 0
        ? recent30dScores.reduce((sum, s) => sum + s.overall_score, 0) / recent30dScores.length
        : null;

    return {
      pilot,
      total_flights,
      recent_flights,
      score_trend,
      personal_bests,
      rolling_30d_avg,
    };
  }

  /** Generate a URL-safe slug from a display name */
  generateSlug(displayName: string): string {
    return displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
