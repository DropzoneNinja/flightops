import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from '../database/entities/flight.entity';
import { FlightEvent } from '../database/entities/flight-event.entity';
import { FlightScore } from '../database/entities/flight-score.entity';
import { NormalizedTrackpoint } from './gpx-normalizer.service';
import { detectPhases, PhasedTrackpoint } from './analysis/phase-detector';
import { detectEvents, FlightEventData } from './analysis/event-detector';
import { computeConfidence } from './analysis/confidence';
import { scoreFlight } from './analysis/scoring/flight-scorer';
import { SCORING_VERSION } from './analysis/scoring/scoring-version';

export interface FlightAnalysisResult {
  flight: Flight;
  score: FlightScore;
  events: FlightEvent[];
}

@Injectable()
export class FlightAnalysisService {
  private readonly logger = new Logger(FlightAnalysisService.name);

  constructor(
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    @InjectRepository(FlightEvent)
    private readonly eventsRepository: Repository<FlightEvent>,
    @InjectRepository(FlightScore)
    private readonly scoresRepository: Repository<FlightScore>,
  ) {}

  /**
   * Run the full analysis pipeline for a flight that has been parsed.
   * Sets analysis_status to 'running' then 'complete' (or 'failed').
   * Called asynchronously after GPX parsing completes.
   */
  async analyzeFlightAsync(flightId: string): Promise<void> {
    const start = Date.now();
    this.logger.log(`[analysis:start] flightId=${flightId} scoringVersion=${SCORING_VERSION}`);

    await this.flightsRepository.update(flightId, {
      analysis_status: 'running',
      analysis_version: SCORING_VERSION,
    });

    try {
      const flight = await this.flightsRepository.findOne({ where: { id: flightId } });
      if (!flight) throw new Error(`Flight ${flightId} not found`);

      // JSONB round-trip: timestamps are serialised as ISO strings — rehydrate to Date
      const rawTrackpoints: NormalizedTrackpoint[] = ((flight.trackpoints_json ?? []) as unknown[]).map(
        (tp: unknown) => {
          const t = tp as Record<string, unknown>;
          return {
            ...t,
            timestamp: t.timestamp ? new Date(t.timestamp as string) : null,
          } as NormalizedTrackpoint;
        },
      );
      if (rawTrackpoints.length === 0) {
        throw new Error('No trackpoints available for analysis');
      }

      // Step 1: Phase detection
      const phasedTrackpoints: PhasedTrackpoint[] = detectPhases(rawTrackpoints);

      // Step 2: Event detection
      const eventData: FlightEventData[] = detectEvents(phasedTrackpoints);

      // Step 3: Confidence (standalone, expanded version)
      const confidence = computeConfidence(rawTrackpoints);

      // Step 4: Scoring
      const scoreData = scoreFlight(phasedTrackpoints, eventData);

      // Step 5: Persist events (delete old ones first for idempotency)
      await this.eventsRepository.delete({ flight_id: flightId });
      if (eventData.length > 0) {
        const eventEntities = eventData.map((e) =>
          this.eventsRepository.create({
            flight_id: flightId,
            event_type: e.event_type,
            timestamp: e.timestamp ?? undefined,
            seq_start: e.seq_start ?? undefined,
            seq_end: e.seq_end ?? undefined,
            lon: e.lon ?? undefined,
            lat: e.lat ?? undefined,
            elevation_m: e.elevation_m ?? undefined,
            confidence: e.confidence,
            payload_json: e.payload_json ?? undefined,
          }),
        );
        await this.eventsRepository.save(eventEntities);
      }

      // Step 6: Persist score (upsert via delete + insert for simplicity)
      await this.scoresRepository.delete({ flight_id: flightId });
      const scoreEntity = this.scoresRepository.create({
        flight_id: flightId,
        scoring_version: scoreData.scoring_version,
        overall_score: scoreData.overall_score,
        takeoff_score: scoreData.takeoff_score ?? undefined,
        climb_score: scoreData.climb_score ?? undefined,
        level_score: scoreData.level_score ?? undefined,
        turn_score: scoreData.turn_score ?? undefined,
        descent_score: scoreData.descent_score ?? undefined,
        landing_score: scoreData.landing_score ?? undefined,
        smoothness_score: scoreData.smoothness_score ?? undefined,
        safety_score: scoreData.safety_score ?? undefined,
        explanation_json: scoreData.explanation_json,
      });
      await this.scoresRepository.save(scoreEntity);

      // Step 7: Update flight with phased trackpoints + updated confidence + analysis status
      await this.flightsRepository.update(flightId, {
        analysis_status: 'complete',
        confidence_score: confidence,
        trackpoints_json: phasedTrackpoints as unknown[],
      });

      const durationMs = Date.now() - start;
      this.logger.log(
        `[analysis:complete] flightId=${flightId} scoringVersion=${SCORING_VERSION} ` +
          `overallScore=${scoreData.overall_score} events=${eventData.length} duration_ms=${durationMs}`,
      );
    } catch (err) {
      const durationMs = Date.now() - start;
      this.logger.error(
        `[analysis:fail] flightId=${flightId} duration_ms=${durationMs} error=${err}`,
      );
      await this.flightsRepository.update(flightId, { analysis_status: 'failed' });
    }
  }

  /**
   * Return the full analysis result for a flight (score + events).
   */
  async getAnalysis(flightId: string): Promise<{ score: FlightScore | null; events: FlightEvent[] }> {
    const [score, events] = await Promise.all([
      this.scoresRepository.findOne({ where: { flight_id: flightId } }),
      this.eventsRepository.find({
        where: { flight_id: flightId },
        order: { timestamp: 'ASC' },
      }),
    ]);
    return { score, events };
  }
}
