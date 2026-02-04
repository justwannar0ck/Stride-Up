import api from '../api';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  elevation?:  number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

export interface Activity {
  id: number;
  user_username: string;
  title: string;
  description: string;
  activity_type: 'run' | 'walk' | 'cycle' | 'hike';
  status: 'in_progress' | 'paused' | 'completed' | 'discarded';
  distance:  number;
  distance_km: number;
  duration: string;
  duration_formatted: string;
  total_elapsed_time: string;
  average_pace: number;
  pace_formatted: string;
  average_speed: number;
  max_speed: number;
  elevation_gain: number;
  elevation_loss: number;
  calories_burned: number;
  started_at: string;
  finished_at:  string;
  visibility: 'public' | 'followers' | 'private';
  hide_start_end: boolean;
  route_geojson: {
    type: 'LineString';
    coordinates: number[][];
  } | null;
  start_location: { latitude: number; longitude: number } | null;
  end_location: { latitude: number; longitude:  number } | null;
  likes_count: number;
  is_liked: boolean;
}

export interface UserStatistics {
  total_activities:  number;
  total_distance_km: number;
  total_duration_hours: number;
  total_calories: number;
  total_elevation_gain: number;
  average_pace: string;
  average_speed: number;
  activities_by_type: Record<string, {
    count: number;
    distance_km: number;
    duration_hours: number;
  }>;
  this_week_distance_km: number;
  this_month_distance_km: number;
  personal_bests:  {
    longest_distance_km: number;
    longest_duration: string;
    fastest_pace: string;
  };
}

export const activityService = {
  // Start a new activity
  startActivity: async (data: {
    activity_type: string;
    visibility?:  string;
    hide_start_end?: boolean;
  }) => {
    const response = await api.post('/api/v1/activities/', data);
    return response.data;
  },

  // Get current active activity
  getCurrentActivity: async () => {
    try {
      const response = await api.get('/api/v1/activities/current/');
      return response.data;
    } catch (error:  any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Upload GPS points
  uploadGPSPoints: async (activityId: number, points: GPSPoint[]) => {
    const response = await api.post('/api/v1/activities/upload_gps/', {
      activity_id: activityId,
      points:  points,
    });
    return response. data;
  },

  // Pause activity
  pauseActivity:  async (activityId: number) => {
    const response = await api.post(`/api/v1/activities/${activityId}/pause/`);
    return response.data;
  },

  // Resume activity
  resumeActivity: async (activityId: number) => {
    const response = await api.post(`/api/v1/activities/${activityId}/resume/`);
    return response.data;
  },

  // Complete activity
  completeActivity: async (activityId: number, data?:  {
    title?: string;
    description?: string;
    visibility?:  string;
    hide_start_end?: boolean;
  }) => {
    const response = await api.post(`/api/v1/activities/${activityId}/complete/`, data || {});
    return response.data;
  },

  // Discard activity
  discardActivity: async (activityId: number) => {
    const response = await api.post(`/api/v1/activities/${activityId}/discard/`);
    return response.data;
  },

  // Get activity details
  getActivity: async (activityId: number): Promise<Activity> => {
    const response = await api.get(`/api/v1/activities/${activityId}/`);
    return response.data;
  },

  // List user's activities
  listActivities: async (params?:  { page?: number; limit?: number }) => {
    const response = await api.get('/api/v1/activities/', { params });
    return response.data;
  },

  // Get user statistics
  getStatistics: async (): Promise<UserStatistics> => {
    const response = await api.get('/api/v1/activities/statistics/');
    return response.data;
  },

  // Update activity
  updateActivity: async (activityId: number, data:  Partial<Activity>) => {
    const response = await api.patch(`/api/v1/activities/${activityId}/`, data);
    return response.data;
  },

  // Delete activity
  deleteActivity: async (activityId: number) => {
    const response = await api.delete(`/api/v1/activities/${activityId}/`);
    return response.data;
  },
};