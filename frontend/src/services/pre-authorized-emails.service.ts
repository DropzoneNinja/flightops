import { api } from './api';

export interface PreAuthorizedEmail {
  id: string;
  email: string;
  notes?: string;
  added_by_user_id?: string;
  used: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePreAuthorizedEmailData {
  email: string;
  notes?: string;
}

export const preAuthorizedEmailsService = {
  /**
   * Get all pre-authorized emails
   */
  async getAll(): Promise<PreAuthorizedEmail[]> {
    const response = await api.get<PreAuthorizedEmail[]>('/pre-authorized-emails');
    return response.data;
  },

  /**
   * Add a new pre-authorized email
   */
  async create(data: CreatePreAuthorizedEmailData): Promise<PreAuthorizedEmail> {
    const response = await api.post<PreAuthorizedEmail>('/pre-authorized-emails', data);
    return response.data;
  },

  /**
   * Delete a pre-authorized email
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/pre-authorized-emails/${id}`);
  },
};
