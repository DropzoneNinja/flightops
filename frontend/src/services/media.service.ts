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
  mission_id?: string | null;
  site?: FlightSite; // Optional site relation
  view_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMediaData {
  flight_date: string; // ISO date string
  uploaded_by: string;
  pilots?: string[];
  notes?: string;
  site_id?: string;
  mission_id?: string;
}

export interface MediaDateCount {
  date: string;
  image_count: number;
  video_count: number;
  flight_count: number;
}

export interface SiteMediaCount {
  site_id: string;
  site_name: string;
  takeoff_lat: number;
  takeoff_lon: number;
  image_count: number;
  video_count: number;
}

export interface MediaFilters {
  uploadedBy?: string;
  pilots?: string[];
  year?: number;
  month?: number;
}

export interface UpdateMediaData {
  flight_date?: string;
  pilots?: string[];
  notes?: string;
  site_id?: string | null;
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
   * Get all distinct pilot names from media entries
   */
  async getUniquePilots(): Promise<string[]> {
    const response = await api.get<string[]>('/media/pilots');
    return response.data;
  },

  /**
   * Search media by filters (uploaded_by, pilots, year, month)
   */
  async searchMedia(filters: MediaFilters): Promise<Media[]> {
    const params: Record<string, string> = {};
    if (filters.uploadedBy) params.uploaded_by = filters.uploadedBy;
    if (filters.pilots?.length) params.pilots = filters.pilots.join(',');
    if (filters.year) params.year = String(filters.year);
    if (filters.month) params.month = String(filters.month);
    const response = await api.get<Media[]>('/media/search', { params });
    return response.data;
  },

  /**
   * Get all unique dates with media counts
   */
  async getMediaDatesWithCounts(filters?: MediaFilters): Promise<MediaDateCount[]> {
    const params: Record<string, string> = {};
    if (filters?.uploadedBy) params.uploaded_by = filters.uploadedBy;
    if (filters?.pilots?.length) params.pilots = filters.pilots.join(',');
    if (filters?.year) params.year = String(filters.year);
    if (filters?.month) params.month = String(filters.month);
    const response = await api.get<MediaDateCount[]>('/media/dates/counts', { params });
    return response.data;
  },

  /**
   * Get all sites with their media counts
   */
  async getSitesWithMediaCounts(filters?: MediaFilters): Promise<SiteMediaCount[]> {
    const params: Record<string, string> = {};
    if (filters?.uploadedBy) params.uploaded_by = filters.uploadedBy;
    if (filters?.pilots?.length) params.pilots = filters.pilots.join(',');
    if (filters?.year) params.year = String(filters.year);
    if (filters?.month) params.month = String(filters.month);
    const response = await api.get<SiteMediaCount[]>('/media/sites/counts', { params });
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
   * Get all media for a specific mission
   */
  async getMediaByMission(missionId: string): Promise<Media[]> {
    const response = await api.get<Media[]>(`/media/mission/${missionId}`);
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
   * Get a presigned token for accessing media files
   * Returns a short-lived (5 minute) token specific to this media file
   */
  async getMediaAccessToken(id: string): Promise<{ token: string; expiresIn: string; mediaId: string }> {
    const response = await api.get<{ token: string; expiresIn: string; mediaId: string }>(`/media/${id}/token`);
    return response.data;
  },

  /**
   * Get the file URL for a media item with a presigned token
   */
  async getMediaFileUrl(id: string): Promise<string> {
    const baseURL = api.defaults.baseURL || '';
    const tokenData = await this.getMediaAccessToken(id);
    return `${baseURL}/media/${id}/file?token=${encodeURIComponent(tokenData.token)}`;
  },

  /**
   * Get the thumbnail URL for a media item with a presigned token
   */
  async getMediaThumbnailUrl(id: string): Promise<string> {
    const baseURL = api.defaults.baseURL || '';
    const tokenData = await this.getMediaAccessToken(id);
    return `${baseURL}/media/${id}/thumbnail?token=${encodeURIComponent(tokenData.token)}`;
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

    if (data.mission_id) {
      formData.append('mission_id', data.mission_id);
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

  /**
   * Update metadata for a media item (uploader or admin only)
   */
  async updateMedia(id: string, data: UpdateMediaData): Promise<Media> {
    const response = await api.patch<Media>(`/media/${id}`, data);
    return response.data;
  },

  /**
   * Increment view count for a media item
   */
  async incrementViewCount(id: string): Promise<void> {
    await api.post(`/media/${id}/view`);
  },

  /**
   * Increment download count for a media item
   */
  async incrementDownloadCount(id: string): Promise<void> {
    await api.post(`/media/${id}/download`);
  },

  /**
   * Regenerate thumbnails for all existing image media (admin only)
   */
  async regenerateThumbnails(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; filename: string; error: string }>;
  }> {
    const response = await api.post('/media/admin/regenerate-thumbnails');
    return response.data;
  },
};
