import { api } from './api';

export interface ApkRelease {
  id: string;
  version_label: string;
  release_notes: string | null;
  original_filename: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface ApkAccessUser {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  has_apk_access: boolean;
}

export const apkReleaseService = {
  /**
   * List all APK releases, newest first (admin or explicitly-authorized users)
   */
  async listReleases(): Promise<ApkRelease[]> {
    const response = await api.get<ApkRelease[]>('/apk-releases');
    return response.data;
  },

  /**
   * Get a presigned, release-specific download token (valid 5 minutes)
   */
  async getDownloadToken(id: string): Promise<{ token: string; expiresIn: string; releaseId: string }> {
    const response = await api.get<{ token: string; expiresIn: string; releaseId: string }>(
      `/apk-releases/${id}/token`,
    );
    return response.data;
  },

  /**
   * Get the file URL for an APK release with a presigned token
   */
  async getDownloadUrl(id: string): Promise<string> {
    const baseURL = api.defaults.baseURL || '';
    const tokenData = await this.getDownloadToken(id);
    return `${baseURL}/apk-releases/${id}/file?token=${encodeURIComponent(tokenData.token)}`;
  },

  /**
   * Upload a new APK release (admin only)
   */
  async uploadRelease(
    file: File,
    versionLabel: string,
    releaseNotes: string | undefined,
    onUploadProgress?: (progressEvent: any) => void,
  ): Promise<ApkRelease> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version_label', versionLabel);
    if (releaseNotes) {
      formData.append('release_notes', releaseNotes);
    }

    const response = await api.post<ApkRelease>('/apk-releases', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });

    return response.data;
  },

  /**
   * Delete an APK release (admin only)
   */
  async deleteRelease(id: string): Promise<void> {
    await api.delete(`/apk-releases/${id}`);
  },

  /**
   * List every user with their current access flag (admin only)
   */
  async listAccess(): Promise<ApkAccessUser[]> {
    const response = await api.get<ApkAccessUser[]>('/apk-releases/access');
    return response.data;
  },

  /**
   * Grant a user access to the Flightoid APK page (admin only)
   */
  async grantAccess(userId: string): Promise<void> {
    await api.post(`/apk-releases/access/${userId}`);
  },

  /**
   * Revoke a user's access to the Flightoid APK page (admin only)
   */
  async revokeAccess(userId: string): Promise<void> {
    await api.delete(`/apk-releases/access/${userId}`);
  },
};
