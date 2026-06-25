import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Media } from '../database/entities/media.entity';

export interface MediaRef {
  id: string;
  media_type: 'image' | 'video';
  original_filename: string;
  uploaded_by: string;
  thumbnail_url: string;
  file_url: string;
}

@Injectable()
export class LogbookMediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  /**
   * Find all media tagged with any of the pilot's name aliases on a given date.
   * Uses the existing `media.pilots && :names` array-overlap pattern.
   */
  async getMediaForPilotOnDate(pilotNames: string[], date: Date): Promise<MediaRef[]> {
    if (!pilotNames.length) return [];

    const rows = await this.mediaRepository
      .createQueryBuilder('media')
      .where('media.flight_date = :date', { date })
      .andWhere('media.pilots && :names', { names: pilotNames })
      .orderBy('media.created_at', 'ASC')
      .getMany();

    return rows.map((m) => this.toRef(m));
  }

  /**
   * Batch-query media for multiple (pilotNames, date) pairs in one round-trip.
   * Returns a map keyed by YYYY-MM-DD date string.
   */
  async getMediaForPilotOnDates(
    pilotNames: string[],
    dates: Date[],
  ): Promise<Map<string, MediaRef[]>> {
    if (!pilotNames.length || !dates.length) return new Map();

    const rows = await this.mediaRepository
      .createQueryBuilder('media')
      .where('media.flight_date IN (:...dates)', { dates })
      .andWhere('media.pilots && :names', { names: pilotNames })
      .orderBy('media.flight_date', 'ASC')
      .addOrderBy('media.created_at', 'ASC')
      .getMany();

    const result = new Map<string, MediaRef[]>();
    for (const m of rows) {
      const key = m.flight_date instanceof Date
        ? m.flight_date.toISOString().split('T')[0]
        : String(m.flight_date);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(this.toRef(m));
    }
    return result;
  }

  private toRef(m: Media): MediaRef {
    return {
      id: m.id,
      media_type: m.media_type,
      original_filename: m.original_filename,
      uploaded_by: m.uploaded_by,
      thumbnail_url: m.thumbnail_path ? `/media/${m.id}/thumbnail` : `/media/${m.id}/file`,
      file_url: `/media/${m.id}/file`,
    };
  }
}
