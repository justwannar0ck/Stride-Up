import api from '../api';

export interface FeedActivity {
  id: number;
  user: UserMinimal;
  title: string;
  description: string;
  activity_type: 'run' | 'walk' | 'cycle' | 'hike';
  distance_km: number;
  duration_formatted: string;
  pace_formatted: string;
  elevation_gain: number | null;
  calories_burned: number | null;
  started_at: string;
  visibility: 'public' | 'followers' | 'private';
  route_geojson: {
    type: 'LineString';
    coordinates: number[][];
  } | null;
  likes_count: number;
  is_liked: boolean;
}

export interface FeedResponse {
  count: number;
  page: number;
  limit: number;
  has_more: boolean;
  results: FeedActivity[];
}

export interface UserMinimal {
  id: number;
  username: string;
  full_name: string;
  profile_picture: string | null;
}

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  bio: string;
  profile_picture: string | null;
  is_private: boolean;
  followers_count: number;
  following_count: number;
  is_following: boolean | null;
  is_followed_by: boolean | null;
  follow_status: 'self' | 'following' | 'requested' | 'not_following';
  created_at: string;
}

export interface FollowerItem {
  id: number;
  user: UserMinimal;
  is_following_back: boolean;
  created_at: string;
}

export interface FollowingItem {
  id: number;
  user: UserMinimal;
  created_at: string;
}

export interface FollowRequest {
  id: number;
  user: UserMinimal;
  created_at: string;
}

export interface FollowRequestsResponse {
  count: number;
  results: FollowRequest[];
}

export interface FollowActionResponse {
  status: 'following' | 'requested' | 'not_following';
  message: string;
}

// API Service

export const followService = {
  // User Profile

  // Gets current user's profile with follow stats
  getMyProfile: async (): Promise<UserProfile> => {
    const response = await api.get('/api/users/me/');
    return response.data;
  },

  // Gets a user's profile by username
  getUserProfile: async (username: string): Promise<UserProfile> => {
    const response = await api.get(`/api/users/${username}/`);
    return response.data;
  },

  // Searchs for users
  searchUsers: async (query: string): Promise<UserMinimal[]> => {
    if (query.length < 2) return [];
    const response = await api.get('/api/search/users/', {
      params: { q: query }
    });
    return response.data;
  },

  // Followers/Following Lists

  // Gets a user's followers
  getFollowers: async (username: string): Promise<FollowerItem[]> => {
    const response = await api.get(`/api/users/${username}/followers/`);
    return response.data;
  },

  // Gets users that a user is following
  getFollowing: async (username: string): Promise<FollowingItem[]> => {
    const response = await api.get(`/api/users/${username}/following/`);
    return response.data;
  },

  // Follow Action

  // Follow a user (or send follow request if private)
  followUser: async (username: string): Promise<FollowActionResponse> => {
    const response = await api.post(`/api/follow/${username}/`);
    return response.data;
  },

  // Unfollow a user or cancel follow request
  unfollowUser: async (username: string): Promise<FollowActionResponse> => {
    const response = await api.delete(`/api/follow/${username}/unfollow/`);
    return response.data;
  },

  // Removes a user from followers
  removeFollower: async (username: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/follow/${username}/remove/`);
    return response.data;
  },

  // Follow Requests

  // Gets pending follow requests
  getFollowRequests: async (): Promise<FollowRequestsResponse> => {
    const response = await api.get('/api/follow-requests/');
    return response.data;
  },

  // Accepts a follow request
  acceptFollowRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/follow-requests/${requestId}/accept/`);
    return response.data;
  },

  // Rejects a follow request
  rejectFollowRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/follow-requests/${requestId}/reject/`);
    return response.data;
  },

  // Accept all pending follow requests
  acceptAllFollowRequests: async (): Promise<{ message: string }> => {
    const response = await api.post('/api/follow-requests/accept_all/');
    return response.data;
  },

  getFeed: async (page: number = 1, limit: number = 20): Promise<FeedResponse> => {
    const response = await api.get('/api/v1/activities/feed/', {
      params: { page, limit }
    });
    return response.data;
  },

    // Interactions

  // Like an activity
  likeActivity: async (activityId: number): Promise<{ message: string; likes_count: number }> => {
    const response = await api.post(`/api/v1/activities/${activityId}/like/`);
    return response.data;
  },

  // Unlike an activity
  unlikeActivity: async (activityId: number): Promise<{ message: string; likes_count: number }> => {
  const response = await api.delete(`/api/v1/activities/${activityId}/like/`);
  return response.data;
},

  // Get users who liked an activity
  getActivityLikes: async (activityId: number): Promise<{ count: number; results: UserMinimal[] }> => {
    const response = await api.get(`/api/v1/activities/${activityId}/likes/`);
    return response.data;
  },
};

export default followService;