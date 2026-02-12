import api from '../api';

export interface PrivacyZone {
  id: number;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius: number;
  is_active: boolean;
  created_at: string;
}

export interface PrivacySettings {
  default_hide_start_end: boolean;
  default_privacy_radius: number;
  default_visibility: 'public' | 'followers' | 'private';
}

export interface CreatePrivacyZoneData {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export const privacyService = {
  // -------- Privacy Zones --------
  
  /**
   * Get all privacy zones for current user
   */
  getPrivacyZones: async (): Promise<PrivacyZone[]> => {
    const response = await api.get('/api/users/me/privacy-zones/');
    return response.data;
  },

  /**
   * Create a new privacy zone
   */
  createPrivacyZone: async (data: CreatePrivacyZoneData): Promise<PrivacyZone> => {
    const response = await api.post('/api/users/me/privacy-zones/', data);
    return response.data;
  },

  /**
   * Update a privacy zone
   */
  updatePrivacyZone: async (
    zoneId: number, 
    data: Partial<CreatePrivacyZoneData & { is_active: boolean }>
  ): Promise<PrivacyZone> => {
    const response = await api.patch(`/api/users/me/privacy-zones/${zoneId}/`, data);
    return response.data;
  },

  /**
   * Delete a privacy zone
   */
  deletePrivacyZone: async (zoneId: number): Promise<void> => {
    await api.delete(`/api/users/me/privacy-zones/${zoneId}/`);
  },

  // -------- Privacy Settings --------
  
  /**
   * Get user's privacy settings
   */
  getPrivacySettings: async (): Promise<PrivacySettings> => {
    const response = await api.get('/api/users/me/privacy-settings/');
    return response.data;
  },

  /**
   * Update user's privacy settings
   */
  updatePrivacySettings: async (
    data: Partial<PrivacySettings>
  ): Promise<PrivacySettings> => {
    const response = await api.patch('/api/users/me/privacy-settings/', data);
    return response.data;
  },
};

export const updateAccountPrivacy = async (isPrivate: boolean): Promise<void> => {
  await api.patch('/api/users/me/', { is_private: isPrivate });
};