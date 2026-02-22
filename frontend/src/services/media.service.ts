import { api } from './api';

export interface FlightSite {
  id: string;
  name: string;
  takeoff_lat: number;
  takeoff_lon: number;
}

export interface Media {
  id: string;
  flight_date: string; // ISO date string
  media_type: 'image' | 'video';
  file_path: string;
  original_filename: string;
  uploaded_by: string;
  pilots: string[];
  notes: string | null;
  mime_type: string;
  file_size: number;
  thumbnail_path: string | null;
  site_id: string | null;
  site?: FlightSite; // Optional site relation
  created_at: string;
  updated_at: string;
}

export interface CreateMediaData {
  flight_date: string; // ISO date string
  uploaded_by: string;
  pilots?: string[];
  notes?: string;
  site_id?: string;
}

export interface MediaDateCount {
  date: string;
  image_count: number;
  video_count: number;
}

export interface SiteMediaCount {
  site_id: string;
  site_name: string;
  takeoff_lat: number;
  takeoff_lon: number;
  image_count: number;
  video_count: number;
}

export const mediaService = {
  /**
   * Get all unique dates that have media
   */
  async getMediaDates(): Promise<string[]> {
    const response = await api.get<string[]>('/media/dates');
    return response.data;
  },

  /**
   * Get all unique dates with media counts
   */
  async getMediaDatesWithCounts(): Promise<MediaDateCount[]> {
    const response = await api.get<MediaDateCount[]>('/media/dates/counts');
    return response.data;
  },

  /**
   * Get all sites with their media counts
   */
  async getSitesWithMediaCounts(): Promise<SiteMediaCount[]> {
    const response = await api.get<SiteMediaCount[]>('/media/sites/counts');
    return response.data;
  },

  /**
   * Get all media for a specific date
   */
  async getMediaByDate(date: string): Promise<Media[]> {
    const response = await api.get<Media[]>('/media', {
      params: { date },
    });
    return response.data;
  },

  /**
   * Get all media for a specific site
   */
  async getMediaBySite(siteId: string): Promise<Media[]> {
    const response = await api.get<Media[]>('/media', {
      params: { site: siteId },
    });
    return response.data;
  },

  /**
   * Get a single media item by ID
   */
  async getMediaById(id: string): Promise<Media> {
    const response = await api.get<Media>(`/media/${id}`);
    return response.data;
  },

  /**
   * Get the file URL for a media item
   */
  getMediaFileUrl(id: string): string {
    const baseURL = api.defaults.baseURL || '';
    const token = localStorage.getItem('access_token');
    return `${baseURL}/media/${id}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  /**
   * Get the thumbnail URL for a media item
   */
  getMediaThumbnailUrl(id: string): string {
    const baseURL = api.defaults.baseURL || '';
    const token = localStorage.getItem('access_token');
    return `${baseURL}/media/${id}/thumbnail${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  /**
   * Upload a new media file
   */
  async uploadMedia(
    file: File,
    data: CreateMediaData,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<Media> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('flight_date', data.flight_date);
    formData.append('uploaded_by', data.uploaded_by);

    if (data.pilots && data.pilots.length > 0) {
      formData.append('pilots', JSON.stringify(data.pilots));
    }

    if (data.notes) {
      formData.append('notes', data.notes);
    }

    if (data.site_id) {
      formData.append('site_id', data.site_id);
    }

    const response = await api.post<Media>('/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return response.data;
  },

  /**
   * Delete a media item by ID (admin only)
   */
  async deleteMedia(id: string): Promise<void> {
    await api.delete(`/media/${id}`);
  },
};
