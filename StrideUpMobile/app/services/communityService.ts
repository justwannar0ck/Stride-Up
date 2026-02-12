import api from '../api';
import { UserMinimal } from './followService';

// ============ Types ============

export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string;
  cover_image: string;
  icon_image: string;
  visibility: 'public' | 'private';
  max_members: number;
  activity_types: string[];
  members_count: number;
  created_by_username: string;
  is_member: boolean;
  my_role: CommunityRole | null;
  created_at: string;
}

export interface CommunityDetail extends Community {
  created_by: UserMinimal;
  pending_count: number;
  active_challenges_count: number;
  updated_at: string;
}

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface CommunityMember {
  id: number;
  user: UserMinimal;
  role: CommunityRole;
  status: 'active' | 'pending' | 'banned' | 'left';
  joined_at: string;
}

export interface CommunityInvite {
  id: number;
  community: number;
  community_name: string;
  invited_user: UserMinimal;
  invited_by: UserMinimal;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string | null;
}

export interface CreateCommunityData {
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
  max_members?: number;
  activity_types?: string[];
}

// ============ API Service ============

export const communityService = {
  // -------- Browse / Search --------

  /**
   * List all communities (optionally filter by search query)
   */
  listCommunities: async (params?: {
    q?: string;
    mine?: boolean;
    page?: number;
  }): Promise<Community[]> => {
    const response = await api.get('/api/v1/communities/', {
      params: {
        ...params,
        mine: params?.mine ? 'true' : undefined,
      },
    });
    // DRF may return paginated or array depending on config
    return Array.isArray(response.data)
      ? response.data
      : response.data.results || [];
  },

  /**
   * Get my communities
   */
  getMyCommunities: async (): Promise<Community[]> => {
    const response = await api.get('/api/v1/communities/', {
      params: { mine: 'true' },
    });
    return Array.isArray(response.data)
      ? response.data
      : response.data.results || [];
  },

  // -------- CRUD --------

  /**
   * Get community detail by ID
   */
  getCommunity: async (id: number): Promise<CommunityDetail> => {
    const response = await api.get(`/api/v1/communities/${id}/`);
    return response.data;
  },

  /**
   * Create a new community
   */
  createCommunity: async (data: CreateCommunityData): Promise<Community> => {
    const response = await api.post('/api/v1/communities/', data);
    return response.data;
  },

  /**
   * Update community settings (owner/admin only)
   */
  updateCommunity: async (
    id: number,
    data: Partial<CreateCommunityData>
  ): Promise<Community> => {
    const response = await api.patch(`/api/v1/communities/${id}/`, data);
    return response.data;
  },

    /**
   * Delete a community (owner only)
   */
  deleteCommunity: async (id: number): Promise<{ detail: string }> => {
    const response = await api.delete(`/api/v1/communities/${id}/`);
    return response.data;
  },

  // -------- Membership --------

  /**
   * Join a community (or request to join if private)
   */
  joinCommunity: async (id: number): Promise<{ detail: string }> => {
    const response = await api.post(`/api/v1/communities/${id}/join/`);
    return response.data;
  },

  /**
   * Leave a community
   */
  leaveCommunity: async (id: number): Promise<{ detail: string }> => {
    const response = await api.post(`/api/v1/communities/${id}/leave/`);
    return response.data;
  },

  /**
   * Get active members of a community
   */
  getMembers: async (id: number): Promise<CommunityMember[]> => {
    const response = await api.get(`/api/v1/communities/${id}/members/`);
    return response.data;
  },

  // -------- Admin Actions --------

  /**
   * Get pending join requests (admin/owner only)
   */
  getPendingRequests: async (id: number): Promise<CommunityMember[]> => {
    const response = await api.get(`/api/v1/communities/${id}/pending/`);
    return response.data;
  },

  /**
   * Approve a pending join request
   */
  approveRequest: async (
    communityId: number,
    membershipId: number
  ): Promise<{ detail: string }> => {
    const response = await api.post(
      `/api/v1/communities/${communityId}/approve/${membershipId}/`
    );
    return response.data;
  },

  /**
   * Reject a pending join request
   */
  rejectRequest: async (
    communityId: number,
    membershipId: number
  ): Promise<{ detail: string }> => {
    const response = await api.post(
      `/api/v1/communities/${communityId}/reject/${membershipId}/`
    );
    return response.data;
  },

  /**
   * Update a member's role (owner/admin only)
   */
  updateMemberRole: async (
    communityId: number,
    membershipId: number,
    role: CommunityRole
  ): Promise<{ detail: string }> => {
    const response = await api.patch(
      `/api/v1/communities/${communityId}/role/${membershipId}/`,
      { role }
    );
    return response.data;
  },

  // -------- Invites --------

  /**
   * Get my pending community invites
   */
  getMyInvites: async (): Promise<CommunityInvite[]> => {
    const response = await api.get('/api/v1/my-invites/');
    return response.data;
  },
};

export default communityService;