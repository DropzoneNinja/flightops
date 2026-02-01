import { api } from './api';

export interface BackupStatus {
  lastBackup: {
    filename: string;
    status: 'success' | 'failed' | 'in_progress';
    type: 'manual' | 'scheduled';
    timestamp: string;
    fileSize: number | null;
    duration: number | null;
    error: string | null;
  } | null;
}

export interface BackupHistoryItem {
  id: string;
  filename: string;
  status: 'success' | 'failed' | 'in_progress';
  type: 'manual' | 'scheduled';
  created_at: string;
  file_size_bytes: number | null;
  duration_ms: number | null;
  error_message: string | null;
}

export const backupService = {
  /**
   * Trigger a manual backup
   */
  async triggerManualBackup(): Promise<{ message: string }> {
    const response = await api.post('/backup/manual');
    return response.data;
  },

  /**
   * Get last backup status
   */
  async getStatus(): Promise<BackupStatus> {
    const response = await api.get<BackupStatus>('/backup/status');
    return response.data;
  },

  /**
   * Get backup history
   */
  async getHistory(): Promise<{ history: BackupHistoryItem[] }> {
    const response = await api.get('/backup/history');
    return response.data;
  },

  /**
   * Update backup schedule
   */
  async updateSchedule(): Promise<{ message: string }> {
    const response = await api.post('/backup/update-schedule');
    return response.data;
  },
};
