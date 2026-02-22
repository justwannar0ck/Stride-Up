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
  // Privacy Zones

  // Gets all privacy zones for current user
  getPrivacyZones: async (): Promise<PrivacyZone[]> => {
    const response = await api.get('/api/users/me/privacy-zones/');
    return response.data;
  },

  // Creates a new privacy zone
  createPrivacyZone: async (data: CreatePrivacyZoneData): Promise<PrivacyZone> => {
    const response = await api.post('/api/users/me/privacy-zones/', data);
    return response.data;
  },

  // Updates a privacy zone
  updatePrivacyZone: async (
    zoneId: number, 
    data: Partial<CreatePrivacyZoneData & { is_active: boolean }>
  ): Promise<PrivacyZone> => {
    const response = await api.patch(`/api/users/me/privacy-zones/${zoneId}/`, data);
    return response.data;
  },

  // Deletes a privacy zone
  deletePrivacyZone: async (zoneId: number): Promise<void> => {
    await api.delete(`/api/users/me/privacy-zones/${zoneId}/`);
  },

  // Privacy Settings

  // Gets user's privacy settings
  getPrivacySettings: async (): Promise<PrivacySettings> => {
    const response = await api.get('/api/users/me/privacy-settings/');
    return response.data;
  },

  // Updates user's privacy settings
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