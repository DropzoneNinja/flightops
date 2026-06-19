import { api } from './api';

export interface OpenSkyStats {
  totalCalls: number;
  totalRejected: number;
  maxPerDay: {
    date: string;
    count: number;
    rejected: number;
  };
  maxPerHour: {
    hour: string;
    count: number;
    rejected: number;
  };
}

export const openSkyService = {
  async getStats(): Promise<OpenSkyStats> {
    const response = await api.get('/opensky/stats');
    return response.data;
  },

  async resetStats(): Promise<void> {
    await api.delete('/opensky/stats');
  },
};
